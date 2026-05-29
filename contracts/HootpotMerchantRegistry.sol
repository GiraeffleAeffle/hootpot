// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HootpotMerchantRegistry
/// @notice Stores the merchant payout addresses that Hootpot checkout is allowed to use.
contract HootpotMerchantRegistry {
    error NotOwner();
    error InvalidInput();
    error MerchantMissing();

    struct Merchant {
        address payout;
        bytes32 metadataHash;
        bool active;
        uint64 updatedAt;
    }

    address public owner;

    mapping(bytes32 merchantId => Merchant merchant) public merchants;
    bytes32[] private merchantIds;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event MerchantSet(
        bytes32 indexed merchantId,
        address indexed payout,
        bytes32 metadataHash,
        bool active
    );

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    constructor(address initialOwner) {
        owner = initialOwner == address(0) ? msg.sender : initialOwner;
        emit OwnershipTransferred(address(0), owner);
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidInput();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setMerchant(
        bytes32 merchantId,
        address payout,
        bytes32 metadataHash,
        bool active
    ) external onlyOwner {
        if (merchantId == bytes32(0) || payout == address(0)) revert InvalidInput();

        if (merchants[merchantId].updatedAt == 0) {
            merchantIds.push(merchantId);
        }

        merchants[merchantId] = Merchant({
            payout: payout,
            metadataHash: metadataHash,
            active: active,
            updatedAt: uint64(block.timestamp)
        });

        emit MerchantSet(merchantId, payout, metadataHash, active);
    }

    function requireActiveMerchant(bytes32 merchantId)
        external
        view
        returns (address payout)
    {
        Merchant memory merchant = merchants[merchantId];
        if (!merchant.active || merchant.payout == address(0)) revert MerchantMissing();
        return merchant.payout;
    }

    function merchantCount() external view returns (uint256) {
        return merchantIds.length;
    }

    function merchantIdAt(uint256 index) external view returns (bytes32) {
        return merchantIds[index];
    }
}
