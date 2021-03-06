// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

interface ICurrencies {
    function add(address _currency, address _lpCurrency) external;

    function remove(address _currency) external;

    function length() external view returns (uint256);

    function at(uint256 _index) external view returns (address);

    function onPool(address _currency) external view returns (address);
}
