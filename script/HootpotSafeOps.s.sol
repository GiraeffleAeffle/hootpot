// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface VmHootpotSafeOps {
    function addr(uint256 privateKey) external returns (address keyAddr);
    function envAddress(string calldata name) external returns (address value);
    function envBytes(string calldata name) external returns (bytes memory value);
    function envOr(string calldata name, uint256 defaultValue) external returns (uint256 value);
    function envUint(string calldata name) external returns (uint256 value);
    function sign(uint256 privateKey, bytes32 digest)
        external
        returns (uint8 v, bytes32 r, bytes32 s);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

interface IHootpotSafeLike {
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

abstract contract HootpotSafeExec {
    VmHootpotSafeOps internal constant vm =
        VmHootpotSafeOps(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint8 internal constant OPERATION_CALL = 0;

    function execSafeCall(address safeAddress, address to, uint256 value, bytes memory data)
        internal
        returns (bytes32 safeTxHash)
    {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address signer = vm.addr(privateKey);
        IHootpotSafeLike safe = IHootpotSafeLike(safeAddress);
        require(safe.getThreshold() == 1, "Safe threshold is not 1");
        require(safe.isOwner(signer), "PRIVATE_KEY is not a Safe owner");

        safeTxHash = safe.getTransactionHash(
            to, value, data, OPERATION_CALL, 0, 0, 0, address(0), address(0), safe.nonce()
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, safeTxHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.startBroadcast(privateKey);
        bool success = safe.execTransaction(
            to, value, data, OPERATION_CALL, 0, 0, 0, address(0), payable(address(0)), signature
        );
        vm.stopBroadcast();

        require(success, "Safe execTransaction failed");
    }
}

/// @notice Executes a generic CALL through a 1-of-1 Hootpot Safe.
/// @dev Set HOOTPOT_SAFE, SAFE_TX_TO, SAFE_TX_DATA, and optional SAFE_TX_VALUE.
contract ExecHootpotSafeCall is HootpotSafeExec {
    function run() external returns (bytes32 safeTxHash) {
        address safe = vm.envAddress("HOOTPOT_SAFE");
        address to = vm.envAddress("SAFE_TX_TO");
        bytes memory data = vm.envBytes("SAFE_TX_DATA");
        uint256 value = vm.envOr("SAFE_TX_VALUE", uint256(0));
        safeTxHash = execSafeCall(safe, to, value, data);
    }
}

/// @notice Makes the Hootpot Safe trust a collateral avatar on Circles Hub v2.
/// @dev This is required before the Safe can redeem HOOT backed by that avatar.
contract TrustHootpotCollateralViaSafe is HootpotSafeExec {
    address private constant HUB_V2 = 0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8;
    uint96 private constant MAX_UINT96 = type(uint96).max;

    function run() external returns (bytes32 safeTxHash) {
        address safe = vm.envAddress("HOOTPOT_SAFE");
        address collateralAvatar = vm.envAddress("HOOTPOT_COLLATERAL_AVATAR");
        bytes memory data =
            abi.encodeWithSignature("trust(address,uint96)", collateralAvatar, MAX_UINT96);
        safeTxHash = execSafeCall(safe, HUB_V2, 0, data);
    }
}
