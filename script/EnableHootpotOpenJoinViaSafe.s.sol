// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface VmSafeExec {
    function addr(uint256 privateKey) external returns (address keyAddr);
    function envAddress(string calldata name) external returns (address value);
    function envUint(string calldata name) external returns (uint256 value);
    function sign(uint256 privateKey, bytes32 digest)
        external
        returns (uint8 v, bytes32 r, bytes32 s);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

interface ISafeLike {
    function nonce() external view returns (uint256);
    function getThreshold() external view returns (uint256);
    function isOwner(address owner) external view returns (bool);
    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) external view returns (bytes32);
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes calldata signatures
    ) external payable returns (bool success);
}

abstract contract SafeExecScript {
    VmSafeExec internal constant vm =
        VmSafeExec(address(uint160(uint256(keccak256("hevm cheat code")))));
}

/// @notice Executes HOOT BaseGroup.setService(openService) through the owner Safe.
/// @dev This is for a 1-of-1 Safe owned by PRIVATE_KEY. Use Safe web app for multisigs.
contract EnableHootpotOpenJoinViaSafe is SafeExecScript {
    uint8 private constant OPERATION_CALL = 0;

    function run() external returns (bytes32 safeTxHash) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address signer = vm.addr(privateKey);
        address ownerSafe = vm.envAddress("HOOTPOT_OWNER_SAFE");
        address group = vm.envAddress("HOOTPOT_GROUP");
        address openService = vm.envAddress("HOOTPOT_OPEN_SERVICE");

        ISafeLike safe = ISafeLike(ownerSafe);
        require(safe.getThreshold() == 1, "Safe threshold is not 1");
        require(safe.isOwner(signer), "PRIVATE_KEY is not a Safe owner");

        bytes memory data = abi.encodeWithSignature("setService(address)", openService);
        uint256 safeNonce = safe.nonce();
        safeTxHash = safe.getTransactionHash(
            group,
            0,
            data,
            OPERATION_CALL,
            0,
            0,
            0,
            address(0),
            address(0),
            safeNonce
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, safeTxHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.startBroadcast(privateKey);
        bool success = safe.execTransaction(
            group,
            0,
            data,
            OPERATION_CALL,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            signature
        );
        vm.stopBroadcast();

        require(success, "Safe execTransaction failed");
    }
}
