// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { HootpotMerchantRegistry } from "../contracts/HootpotMerchantRegistry.sol";
import { HootpotPrizePool } from "../contracts/HootpotPrizePool.sol";
import { HootpotReceiptRegistry } from "../contracts/HootpotReceiptRegistry.sol";

interface Vm {
    function envAddress(string calldata name) external returns (address value);
    function startBroadcast() external;
    function stopBroadcast() external;
}

abstract contract Script {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
}

contract DeployHootpot is Script {
    function run()
        external
        returns (
            HootpotMerchantRegistry merchantRegistry,
            HootpotReceiptRegistry receiptRegistry,
            HootpotPrizePool prizePool
        )
    {
        address owner = vm.envAddress("HOOTPOT_OWNER");

        vm.startBroadcast();
        merchantRegistry = new HootpotMerchantRegistry(owner);
        receiptRegistry = new HootpotReceiptRegistry(owner);
        prizePool = new HootpotPrizePool(owner, address(merchantRegistry), address(receiptRegistry));
        vm.stopBroadcast();
    }
}
