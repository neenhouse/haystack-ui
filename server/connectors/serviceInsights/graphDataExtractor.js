/* eslint-disable no-param-reassign */
/*
 * Copyright 2019 Expedia Group
 *
 *         Licensed under the Apache License, Version 2.0 (the "License");
 *         you may not use this file except in compliance with the License.
 *         You may obtain a copy of the License at
 *
 *             http://www.apache.org/licenses/LICENSE-2.0
 *
 *         Unless required by applicable law or agreed to in writing, software
 *         distributed under the License is distributed on an "AS IS" BASIS,
 *         WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *         See the License for the specific language governing permissions and
 *         limitations under the License.
 */

const {type, relationship} = require('../../../universal/enums');
const {detectCycles} = require('./detectCycles');
const {edge, gateway, mesh, database, outbound, service} = require('../../config/config').connectors.serviceInsights.spanTypes;

/**
 * createNode()
 * Function to create a graph node and enforce data schema for creating a node
 * @param {object} data
 */
function createNode(data) {
    // Sanity check required properties
    ['id', 'name'].forEach((requiredProperty) => {
        /* istanbul ignore if -- this is to identify misconfiguration during development */
        if (typeof data[requiredProperty] === 'undefined') {
            throw new Error(`Missing required property ${requiredProperty} when calling createNode()`);
        }
    });
    return {
        count: 1,
        ...data,
        // temporary references to upstream and downstream nodes for efficient traversal
        upstream: [],
        downstream: []
    };
}

/**
 * createLink()
 * Function to create a graph edge and enforce data schema for creating a edge
 * @param {object} data
 */
function createLink(data) {
    // Sanity check required properties
    ['source', 'target'].forEach((requiredProperty) => {
        /* istanbul ignore if -- this is to identify misconfiguration during development */
        if (typeof data[requiredProperty] === 'undefined') {
            throw new Error(`Missing required property ${requiredProperty} when calling createLink()`);
        }
    });
    return {
        isUninstrumented: false,
        count: 1,
        tps: 1,
        ...data
    };
}

/**
 * getNodeNameFromSpan()
 * Gets the display name given a span object
 * @param {object} span - Haystack span object
 */
function getNodeNameFromSpan(span) {
    if (edge && edge.isType(span)) {
        return edge.nodeName(span);
    }
    if (gateway && gateway.isType(span)) {
        return gateway.nodeName(span);
    }
    if (mesh && mesh.isType(span)) {
        return mesh.nodeName(span);
    }
    if (database && database.isType(span)) {
        return database.nodeName(span);
    }
    if (outbound && outbound.isType(span)) {
        return outbound.nodeName(span);
    }
    /* istanbul ignore else -- required configuration */
    if (service) {
        return service.nodeName(span);
    }
    /* istanbul ignore next */
    throw new Error('Missing required configuration: connectors.serviceInsights.spanTypes.service');
}

/**
 * getNodeIdFromSpan()
 * Gets the unique id given a span object, considering when to treat spans as the same node or separate
 * @param {object} span - Haystack span object
 */
function getNodeIdFromSpan(span) {
    if (edge && edge.isType(span)) {
        return edge.nodeId(span);
    }
    if (gateway && gateway.isType(span)) {
        return gateway.nodeId(span);
    }
    if (mesh && mesh.isType(span)) {
        return mesh.nodeId(span);
    }
    if (database && database.isType(span)) {
        return database.nodeId(span);
    }
    if (outbound && outbound.isType(span)) {
        return outbound.nodeId(span);
    }
    /* istanbul ignore else -- required configuration */
    if (service) {
        return service.nodeId(span);
    }
    /* istanbul ignore next */
    throw new Error('Missing required configuration: connectors.serviceInsights.spanTypes.service');
}

/**
 * traverseDownstream()
 * Traverse downstream nodes and set their relationship if not already set.
 * @param {object} startingNode - traverse nodes downstream from this one; this node itself is unmodified
 * @param {boolean} distributary - set the relationship to distributary, otherwise downstream
 */
function traverseDownstream(startingNode, distributary = false) {
    startingNode.downstream.forEach((downstreamNode) => {
        if (!downstreamNode.relationship) {
            downstreamNode.relationship = distributary ? relationship.distributary : relationship.downstream;
            traverseDownstream(downstreamNode, distributary);
        }
    });
}

/**
 * traverseUpstream()
 * Traverse upstream nodes and set their relationship to upstream if not already set.
 * @param {object} startingNode - traverse nodes upstream from this one; this node itself is unmodified
 */
function traverseUpstream(startingNode) {
    startingNode.upstream.forEach((upstreamNode) => {
        if (!upstreamNode.relationship) {
            upstreamNode.relationship = relationship.upstream;
            traverseUpstream(upstreamNode);
            traverseDownstream(upstreamNode, true);
        }
    });
}

/**
 * processNodesAndLinks()
 * Process nodes and links
 * @param {Map} nodes - Map of nodes
 * @param {Map} links - Map of links
 * @returns {object}
 */
function processNodesAndLinks(nodes, links) {
    // Marks nodes and links with invalid DAG cyces
    const cyclesFound = detectCycles({nodes, links});

    // Store unique traces to calculate how many traces were considered
    const uniqueTraces = new Set();

    // Store count of uninstrumented
    let uninstrumentedCount = 0;

    // Process Links
    links.forEach((link) => {
        const source = nodes.get(link.source);
        const target = nodes.get(link.target);

        // Simplify traversal by setting upstream and downstream nodes
        source.downstream.push(target);
        target.upstream.push(source);

        // Process invalid DAG cycle
        if (source.invalidCycleDetected === true && target.invalidCycleDetected === true) {
            link.invalidCycleDetected = true;
            link.invalidCyclePath = source.invalidCyclePath;
        }
    });

    // Traverse nodes upstream and downstream of the central node and set their relationship
    const centralNode = [...nodes.values()].find((node) => node.relationship === relationship.central);
    traverseDownstream(centralNode);
    traverseUpstream(centralNode);

    // Process nodes
    nodes.forEach((node) => {
        // Detect unique traces
        node.traceIds.forEach((traceId) => {
            uniqueTraces.add(traceId);
        });

        // Nodes not previously traversed have an unknown relationship
        if (!node.relationship) {
            node.relationship = relationship.unknown;
        }

        // Check if un-instrumented mesh or client span
        if (node.downstream.length === 0) {
            if (node.type === type.mesh) {
                uninstrumentedCount++;

                // Create uninstrumented node and add it to the map
                const uninstrumentedNode = createNode({
                    ...node,
                    id: `${node.id}-missing-trace`,
                    name: 'Uninstrumented Service',
                    serviceName: 'unknown',
                    type: type.uninstrumented,
                    relationship: node.relationship
                });
                nodes.set(uninstrumentedNode.id, uninstrumentedNode);

                // Create link to uninstrumented node
                const linkId = `${node.id}→${uninstrumentedNode.id}`;
                links.set(
                    linkId,
                    createLink({
                        source: node.id,
                        target: uninstrumentedNode.id,
                        isUninstrumented: true
                    })
                );
            } else if (node.type === type.outbound) {
                uninstrumentedCount++;
                node.type = type.uninstrumented;
            }
        }

        // Remove upstream and downstream properties before serializing
        delete node.upstream;
        delete node.downstream;
    });

    // TODO: filter out distributary and unknown nodes, also their links

    // Define map of violations
    const violations = {};

    // Summarize cycle violations
    if (cyclesFound > 0) {
        violations.cycles = cyclesFound;
    }

    // Summarize unique count of uninstrumented dependencies
    if (uninstrumentedCount > 0) {
        violations.uninstrumented = uninstrumentedCount;
    }

    // Summarize if any types of violations found
    const hasViolations = Object.keys(violations).length > 0;

    return {
        violations,
        hasViolations,
        tracesConsidered: uniqueTraces.size
    };
}

/**
 * createNodeFromSpan()
 * @param {string} nodeId
 * @param {object} span
 * @param {string} serviceName indicates which service is central to this graph
 */
function createNodeFromSpan(nodeId, span, serviceName) {
    const nodeName = getNodeNameFromSpan(span);

    const node = createNode({
        id: nodeId,
        name: nodeName,
        serviceName: span.serviceName,
        duration: span.duration,
        operations: {[`${span.operationName}`]: 1},
        traceIds: [span.traceId]
    });

    if (edge && edge.isType(span)) {
        node.type = type.edge;
    } else if (gateway && gateway.isType(span)) {
        node.type = type.gateway;
    } else if (mesh && mesh.isType(span)) {
        node.type = type.mesh;
    } else if (database && database.isType(span)) {
        node.type = type.database;
        node.databaseType = database.databaseType(span);
    } else if (outbound && outbound.isType(span)) {
        node.type = type.outbound;
    } else {
        node.type = type.service;
    }

    if (node.serviceName === serviceName && node.type !== type.outbound) {
        node.relationship = relationship.central;
    }

    return node;
}

/**
 * updateNodeFromSpan()
 * @param {object} node
 * @param {object} span
 */
function updateNodeFromSpan(node, span) {
    node.operations[span.operationName] = node.operations[span.operationName] ? node.operations[span.operationName] + 1 : 1;
    node.count++;
    node.duration += span.duration;
    node.avgDuration = `${Math.floor(node.duration / node.count / 1000)} ms`;
    node.traceIds.push(span.traceId);
}

/**
 * buildNodes()
 * Builds a map of nodes.
 * @param {Array<span>} spans - Array of fully hydrated Haystack spans
 * @param {string} serviceName - Name of central dependency
 */
function buildNodes(spans, serviceName) {
    const nodes = new Map();

    spans.forEach((span) => {
        const nodeId = getNodeIdFromSpan(span);
        const existingNode = nodes.get(nodeId);

        if (!existingNode) {
            const newNode = createNodeFromSpan(nodeId, span, serviceName);
            nodes.set(nodeId, newNode);
        } else {
            updateNodeFromSpan(existingNode, span);
        }
    });

    return nodes;
}

/**
 * buildLinks()
 * Builds a map of links.
 * @param {*} spans
 */
function buildLinks(spans) {
    const linkMap = new Map(); // linkId: link
    const spansById = new Map(); // spanId: span

    spans.forEach((span) => {
        spansById.set(span.spanId, span);
    });

    spans.forEach((span) => {
        const parentSpanId = span.parentSpanId;
        if (parentSpanId) {
            const parentSpan = spansById.get(parentSpanId);
            if (parentSpan) {
                const parentNodeId = getNodeIdFromSpan(parentSpan);
                const childNodeId = getNodeIdFromSpan(span);
                if (parentNodeId !== childNodeId) {
                    const linkId = `${parentNodeId}→${childNodeId}`;
                    const currentLink = linkMap.get(linkId);
                    // If link does not exist in map, create it
                    if (!currentLink) {
                        linkMap.set(
                            linkId,
                            createLink({
                                source: parentNodeId,
                                target: childNodeId
                            })
                        );
                    } else {
                        // else, calculate magnitude
                        currentLink.count++;
                        currentLink.tps++;
                    }
                }
            }
        }
    });

    return linkMap;
}

/**
 * extractNodesAndLinks()
 * Given an array of spans and a service name, perform transform to build a nodes + links structure from multiple traces
 * @param {*} spans - Array of fully hydrated span objects related to multiple traces
 * @param {*} serviceName - Service name to search for
 */
const extractNodesAndLinks = ({spans, serviceName, traceLimitReached}) => {
    // build map of nodes
    const nodes = buildNodes(spans, serviceName);

    // build map of links
    const links = buildLinks(spans);

    // Process nodes and links for consumption of graphing library
    const summary = processNodesAndLinks(nodes, links);
    summary.traceLimitReached = traceLimitReached;

    return {
        summary,
        nodes: [...nodes.values()],
        links: [...links.values()]
    };
};

module.exports = {
    extractNodesAndLinks
};
