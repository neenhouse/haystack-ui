/*
 * Copyright 2017 Expedia, Inc.
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

const requestBuilder = {};
const messages = require('../../../../../static_codegen/traceReader_pb');

const reservedField = ['startTime', 'endTime', 'limit', 'spanLevelFilters'];
const DEFAULT_RESULTS_LIMIT = 50;

function createFieldsList(query) {
    return Object.keys(query)
    .filter(key => query[key] && !reservedField.includes(key))
    .map((key) => {
        const field = new messages.Field();
        field.setName(key);
        field.setValue(query[key]);

        return field;
    });
}

function createSpanLevelExpression(spanLevelFilters) {
    return spanLevelFilters.map((filterJson) => {
       const filter = JSON.parse(filterJson);

        const expressionTree = new messages.ExpressionTree();
        expressionTree.setOperator(messages.ExpressionTree.Operator.AND);
        expressionTree.setIsspanlevelexpression(false);

        const operands = Object.keys(filter)
        .map((key) => {
            const operand = new messages.Operand();

            const field = new messages.Field();
            field.setName(key);
            field.setValue(filter[key]);

            operand.setField(field);

            return operand;
        });

        expressionTree.setOperandsList(operands);
        return expressionTree;
    });
}

function createTraceLevelOperands(query) {
    return Object.keys(query)
    .filter(key => query[key] && !reservedField.includes(key))
    .map((key) => {
        const operand = new messages.Operand();

        const field = new messages.Field();
        field.setName(key);
        field.setValue(query[key]);

        operand.setField(field);

        return operand;
    });
}

function createFilterExpression(query) {
    const expressionTree = new messages.ExpressionTree();

    expressionTree.setOperator(messages.ExpressionTree.Operator.AND);
    expressionTree.setIsspanlevelexpression(false);

    const traceLevelOperands = createTraceLevelOperands(query);
    let spanLevelExpressions = [];
    if (query.spanLevelFilters) {
        spanLevelExpressions = createSpanLevelExpression(JSON.parse(query.spanLevelFilters));
    }

    expressionTree.setOperandsList([...traceLevelOperands, ...spanLevelExpressions]);

    return expressionTree;
}

requestBuilder.buildRequest = (query) => {
    const request = new messages.TracesSearchRequest();

    if (query.useExpressionTree) {
        request.getFilterexpression(createFilterExpression(query));
    } else {
        request.setFieldsList(createFieldsList(query));
    }

    request.setStarttime(parseInt(query.startTime, 10));
    request.setEndtime(parseInt(query.endTime, 10));
    request.setLimit(parseInt(query.limit, 10) || DEFAULT_RESULTS_LIMIT);

    return request;
};

module.exports = requestBuilder;
