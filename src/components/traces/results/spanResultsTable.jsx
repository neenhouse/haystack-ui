/*
 * Copyright 2018 Expedia Group
 *
 *       Licensed under the Apache License, Version 2.0 (the "License");
 *       you may not use this file except in compliance with the License.
 *       You may obtain a copy of the License at
 *
 *           http://www.apache.org/licenses/LICENSE-2.0
 *
 *       Unless required by applicable law or agreed to in writing, software
 *       distributed under the License is distributed on an "AS IS" BASIS,
 *       WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *       See the License for the specific language governing permissions and
 *       limitations under the License.
 *
 */

import React from 'react';
import PropTypes from 'prop-types';
import {BootstrapTable, TableHeaderColumn} from 'react-bootstrap-table';
import ColorHash from 'color-hash';

import TagsTable from '../details/timeline/tagsTable';
import TagsFilter from './tagsFilter';
import formatters from '../../../utils/formatters';
import colorMapper from '../../../utils/serviceColorMapper';
import linkBuilder from '../../../utils/linkBuilder';
import '../../common/resultsTable.less';

const colorHashLight = new ColorHash({lightness: 0.95});
const colorHashDark = new ColorHash({lightness: 0.4});

export default class SpansResultsTable extends React.Component {
    static propTypes = {
        results: PropTypes.object.isRequired
    };

    static insertErrorAsKeyInResults(results) {
        const mappedResults = results;
        mappedResults.map((span) => {
            const newSpan = span;
            let error = false;
            newSpan.tags.forEach((tag) => { if (tag.key === 'error' && tag.value === true) error = true; });
            newSpan.error = error;
            return newSpan;
        });
        return mappedResults;
    }

    static linkFormatter(traceId) {
        return `<div class="spans-panel__traceid" 
                    style="background-color: ${colorHashLight.hex(traceId)}; border-color: ${colorHashDark.hex(traceId)}">
                    <span class="ti-new-window"></span> <a class="spans-panel__traceid-link" target="_blank" href="${linkBuilder.universalSearchTracesLink({traceId})}">${traceId}</a>
                </div>`;
    }

    static serviceFormatter(service) {
        return `<div class="table__secondary">
        <span class="service-spans label ${colorMapper.toBackgroundClass(service)}">${service}</span>
        </div>`;
    }

    static timeColumnFormatter(startTime) {
        return `<div class="table__secondary">${formatters.toTimestring(startTime)}</div>`;
    }

    static errorFormatter(error) {
        if (error === true) {
            return <img src="/images/error.svg" alt="Error" height="18" width="18" />;
        }
        return <img src="/images/success.svg" alt="Success" height="18" width="18" />;
    }

    static tagsFormatter(tags) {
        let tagsList = '';
        tags.slice(0, 3).map((tag) => {
            const key = tag.key.length > 12 ? `${tag.key.slice(0, 9)}...` : tag.key;
            const value = tag.value.length > 12 ? `${tag.value.slice(0, 9)}...` : tag.value;
            tagsList += `<span class="spans-panel__tags-listing-item">${key}=${value}</span> `;
            return tagsList;
        });

        const moreMessage = tags.length > 4
            ? `<a class="spans-panel__tags-listing-more-msg">+ ${tags.length - 3} more tags</a>`
            : '';

        return `<div class="spans-panel__tags-listing"><div class="pull-left">${tagsList}</div> <div class="pull-right">${moreMessage}</div><div>`;
    }

    static totalDurationColumnFormatter(duration) {
        return `<div class="table__secondary text-right">${formatters.toDurationString(duration)}</div>`;
    }

    static Header({name}) {
        return <span className="results-header">{name}</span>;
    }

    constructor(props) {
        super(props);
        this.state = {
            expanding: [],
            selected: []
        };
        this.handleExpand = this.handleExpand.bind(this);
        this.expandComponent = this.expandComponent.bind(this);
    }

    handleExpand(rowKey, isExpand) {
        if (isExpand) {
            this.setState(
                {
                    expanding: [rowKey],
                    selected: [rowKey]
                }
            );
        } else {
            this.setState(
                {
                    expanding: [],
                    selected: []
                }
            );
        }
    }

    expandComponent(row) {
        if (this.state.selected.filter(id => id === row.spanId).length > 0) {
            return (<section className="table-row-details">
                        <TagsTable tags={row.tags}/>
                </section>);
        }
        return null;
    }


    render() {
        const {
            results
        } = this.props;

        const formattedResults = SpansResultsTable.insertErrorAsKeyInResults(results);

        const selectRowProp = {
            clickToSelect: true,
            clickToExpand: true,
            className: 'selected-row',
            mode: 'checkbox',
            hideSelectColumn: true,
            selected: this.state.selected
        };

        const options = {
            page: 1,  // which page you want to show as default
            sizePerPage: 50,  // which size per page you want to locate as default
            pageStartIndex: 1, // where to start counting the pages
            paginationSize: 3,  // the pagination bar size.
            prePage: 'Prev', // Previous page button text
            nextPage: 'Next', // Next page button text
            firstPage: 'First', // First page button text
            lastPage: 'Last', // Last page button text
            onExpand: this.handleExpand,
            expanding: this.state.expanding,
            expandBodyClass: 'expand-row-body',
            paginationShowsTotal: (start, to, total) =>
                (<p>Showing spans { start } to { to } out of { total } {total === 1 ? 'sample' : 'samples'}</p>),
            hideSizePerPage: true // Hide page size bar
        };

        const successFilterTypes = {
            true: 'Error',
            false: 'Success'
        };

        const getCustomFilter = filterHandler => <TagsFilter filterHandler={filterHandler}/>;
        const tableHeaderStyle = { border: 'none' };
        const filter = {type: 'RegexFilter', delay: 0, placeholder: ' '};
        return (
                <BootstrapTable
                    data={formattedResults}
                    className="spans-panel"
                    tableStyle={{ border: 'none' }}
                    trClassName="tr-no-border"
                    options={options}
                    pagination
                    expandableRow={() => true}
                    expandComponent={this.expandComponent}
                    selectRow={selectRowProp}
                >
                    <TableHeaderColumn
                        dataField="traceId"
                        width="16"
                        dataFormat={SpansResultsTable.linkFormatter}
                        thStyle={tableHeaderStyle}
                        headerText={''}
                    ><SpansResultsTable.Header name="TraceId"/></TableHeaderColumn>
                    <TableHeaderColumn
                        dataField="spanId"
                        width="10"
                        thStyle={tableHeaderStyle}
                        headerText={''}
                        isKey
                    ><SpansResultsTable.Header name="SpanId"/></TableHeaderColumn>
                    <TableHeaderColumn
                        dataField="startTime"
                        dataFormat={SpansResultsTable.timeColumnFormatter}
                        width="12"
                        thStyle={tableHeaderStyle}
                        headerText={'Start time of the first span in local timezone'}
                    ><SpansResultsTable.Header name="Start Time"/></TableHeaderColumn>
                    <TableHeaderColumn
                        dataField="serviceName"
                        dataFormat={SpansResultsTable.serviceFormatter}
                        width="20"
                        filter={{...filter, placeholder: 'Filter service...'}}
                        thStyle={tableHeaderStyle}
                        headerText={'Service name'}
                    ><SpansResultsTable.Header name="Service"/></TableHeaderColumn>
                    <TableHeaderColumn
                        dataField="operationName"
                        width="20"
                        filter={{...filter, placeholder: 'Filter operations...'}}
                        thStyle={tableHeaderStyle}
                        headerText={'Operation name'}
                    ><SpansResultsTable.Header name="Operation"/></TableHeaderColumn>
                    <TableHeaderColumn
                        dataField="error"
                        width="5"
                        dataFormat={SpansResultsTable.errorFormatter}
                        // formatExtraData={successFilterTypes}
                        filter={{type: 'SelectFilter', options: successFilterTypes, placeholder: 'All'}}
                        thStyle={tableHeaderStyle}
                        headerText={'Success of the span'}
                    ><SpansResultsTable.Header name="Success"/></TableHeaderColumn>
                    <TableHeaderColumn
                        dataField="duration"
                        dataFormat={SpansResultsTable.totalDurationColumnFormatter}
                        width="10"
                        filter={{...filter, placeholder: 'Filter duration...'}}
                        thStyle={tableHeaderStyle}
                        headerText={'Duration of the span'}
                    ><SpansResultsTable.Header name="Duration"/></TableHeaderColumn>
                    <TableHeaderColumn
                        dataField="tags"
                        width="75"
                        dataFormat={SpansResultsTable.tagsFormatter}
                        filter={{ type: 'CustomFilter', getElement: getCustomFilter}}
                        thStyle={tableHeaderStyle}
                        headerText={'Tags of the span'}
                    ><SpansResultsTable.Header name="Tags"/></TableHeaderColumn>
                </BootstrapTable>
        );
    }
}
