/*
 * Copyright 2019 Expedia Group
 *
 *       Licensed under the Apache License, Version 2.0 (the License);
 *       you may not use this file except in compliance with the License.
 *       You may obtain a copy of the License at
 *
 *           http://www.apache.org/licenses/LICENSE-2.0
 *
 *       Unless required by applicable law or agreed to in writing, software
 *       distributed under the License is distributed on an AS IS BASIS,
 *       WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *       See the License for the specific language governing permissions and
 *       limitations under the License.
 *
 */

import {expect} from 'chai';
const proxyquire = require('proxyquire');

const connector = proxyquire('../../../../server/connectors/serviceInsights/serviceInsightsConnector', {
    './fetcher': (serviceName) => {
        return {
            fetch: () => {
                return new Promise((resolve) => {
                    return resolve({
                        serviceName,
                        spans: [
                            {
                                spanId: 1,
                                parentSpanId: 1,
                                serviceName,
                                operationName: 'operation',
                                tags: []
                            }
                        ]
                    });
                });
            }
        };
    }
});

describe('serviceInsightsConnector.getServiceInsightsForService', () => {
    it('should initialize promise and return data', (done) => {
        // given, when
        connector
            .getServiceInsightsForService('mock-service', 1000, 2000)
            .then((result) => {
                // then
                expect(result.summary.tracesConsidered).to.equal(1);
                expect(result.nodes.length).to.equal(1);
                done();
            })
            .done();
    });
});
