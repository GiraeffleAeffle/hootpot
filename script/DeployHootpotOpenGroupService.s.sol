// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { HootpotOpenGroupService } from "../contracts/HootpotOpenGroupService.sol";

interface VmOpenGroupService {
    function envAddress(string calldata name) external returns (address value);
    function startBroadcast() external;
    function stopBroadcast() external;
}

abstract contract OpenGroupServiceScript {
    VmOpenGroupService internal constant vm =
        VmOpenGroupService(address(uint160(uint256(keccak256("hevm cheat code")))));
}

contract DeployHootpotOpenGroupService is OpenGroupServiceScript {
    function run() external returns (HootpotOpenGroupService service) {
        address group = vm.envAddress("HOOTPOT_GROUP");

        vm.startBroadcast();
        service = new HootpotOpenGroupService(group);
        vm.stopBroadcast();
    }
}
