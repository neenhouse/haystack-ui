/*
 * Copyright 2018 Expedia Group
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

import React from 'react';
import {observer} from 'mobx-react';
import PropTypes from 'prop-types';

@observer
export default class Chips extends React.Component {
    static propTypes = {
        uiState: PropTypes.object.isRequired,
        deleteChip: PropTypes.func.isRequired
    };

    static truncateLongValues(chipValue) {
        if (chipValue.length > 12) {
            return `${chipValue.substring(0, 12)}...`;
        }
        return chipValue;
    }

    constructor(props) {
        super(props);
        this.state = {
            chips: this.props.uiState.chips,
            showSurplus: false
        };
        this.showSurplus = this.showSurplus.bind(this);
        this.hideSurplus = this.hideSurplus.bind(this);
        this.setWrapperRef = this.setWrapperRef.bind(this);
    }

    componentWillReceiveProps() {
        this.setState({
            chips: this.props.uiState.chips
        });
    }

    setWrapperRef(node) {
        this.wrapperRef = node;
    }


    showSurplus() {
        this.setState({
            showSurplus: true
        });
        document.addEventListener('mousedown', this.hideSurplus);
    }

    hideSurplus(e) {
        if (this.wrapperRef && !this.wrapperRef.contains(e.target)) {
            this.setState({
                showSurplus: false
            });
            document.removeEventListener('mousedown', this.hideSurplus);
        }
    }

    render() {
        const chips = Object.keys(this.props.uiState.chips).map((chip) => {
            if (chip.includes('nested_')) {
                const baseObject = this.props.uiState.chips[chip];

                return (
                    <div className="usb-chip" key={Math.random()}>
                        {
                            Object.keys(baseObject).map(key => (
                                <span key={Math.random()}>
                                    <span className="usb-chip__key">{key}</span>
                                    <span className="usb-chip__value">{Chips.truncateLongValues(baseObject[key])}</span>
                                </span>
                            ))
                        }
                        <button type="button" className="usb-chip__delete" onClick={() => this.props.deleteChip(chip)}>x</button>
                    </div>
                );
            }

            return (
                <div className="usb-chip" key={Math.random()}>
                    <span className="usb-chip__key">{chip}</span>
                    <span className="usb-chip__value">{Chips.truncateLongValues(this.props.uiState.chips[chip])}</span>
                    <button type="button" className="usb-chip__delete" onClick={() => this.props.deleteChip(chip)}>x</button>
                </div>
            );
        });

        if (chips.length > 3) {
            const surplus = chips.length - 3;
            return (
                <div ref={this.setWrapperRef} className="usb-chips">
                    {chips.slice(0, 3)}
                    {this.state.showSurplus ?
                        <div className="usb-surplus">{chips.slice(3, chips.length)}</div> :
                        <span role="button" tabIndex="-1" className="usb-surplus-button" onClick={this.showSurplus}>+{surplus}</span>
                    }
                </div>
            );
        }

        return (
            <div className="usb-chips">
                {chips}
            </div>
        );
    }
}
