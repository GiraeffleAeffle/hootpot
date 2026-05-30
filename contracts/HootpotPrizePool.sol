// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Like {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title HootpotPrizePool
/// @notice A small fundable pool for hackathon prizes and payout proofs.
/// @dev CRC checkout payments should still go directly to merchants. This pool is for prize funding.
contract HootpotPrizePool {
    error NotOwner();
    error InvalidInput();
    error NativeTransferFailed();
    error TokenTransferFailed();

    address public owner;
    address public merchantRegistry;
    address public receiptRegistry;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RegistrySet(address indexed merchantRegistry, address indexed receiptRegistry);
    event NativeFunded(address indexed funder, uint256 amount, bytes32 indexed memo);
    event TokenFunded(
        address indexed funder,
        address indexed token,
        uint256 amount,
        bytes32 indexed memo
    );
    event CrcFundingRecorded(
        address indexed funder,
        uint256 amountAttoCrc,
        bytes32 indexed fundingTxHash,
        bytes32 memo
    );
    event PayoutSent(
        address indexed recipient,
        address indexed token,
        uint256 amount,
        bytes32 indexed memo
    );

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    constructor(address initialOwner, address initialMerchantRegistry, address initialReceiptRegistry) {
        if (initialOwner == address(0)) revert InvalidInput();
        owner = initialOwner;
        merchantRegistry = initialMerchantRegistry;
        receiptRegistry = initialReceiptRegistry;
        emit OwnershipTransferred(address(0), owner);
        emit RegistrySet(initialMerchantRegistry, initialReceiptRegistry);
    }

    receive() external payable {
        emit NativeFunded(msg.sender, msg.value, bytes32(0));
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidInput();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setRegistries(address newMerchantRegistry, address newReceiptRegistry)
        external
        onlyOwner
    {
        merchantRegistry = newMerchantRegistry;
        receiptRegistry = newReceiptRegistry;
        emit RegistrySet(newMerchantRegistry, newReceiptRegistry);
    }

    function fundNative(bytes32 memo) external payable {
        if (msg.value == 0) revert InvalidInput();
        emit NativeFunded(msg.sender, msg.value, memo);
    }

    function fundToken(address token, uint256 amount, bytes32 memo) external {
        if (token == address(0) || amount == 0) revert InvalidInput();
        bool ok = IERC20Like(token).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TokenTransferFailed();
        emit TokenFunded(msg.sender, token, amount, memo);
    }

    function recordCrcFunding(
        address funder,
        uint256 amountAttoCrc,
        bytes32 fundingTxHash,
        bytes32 memo
    ) external onlyOwner {
        if (funder == address(0) || amountAttoCrc == 0 || fundingTxHash == bytes32(0)) {
            revert InvalidInput();
        }
        emit CrcFundingRecorded(funder, amountAttoCrc, fundingTxHash, memo);
    }

    function sendNativePayout(address payable recipient, uint256 amount, bytes32 memo)
        external
        onlyOwner
    {
        if (recipient == address(0) || amount == 0) revert InvalidInput();
        (bool ok,) = recipient.call{ value: amount }("");
        if (!ok) revert NativeTransferFailed();
        emit PayoutSent(recipient, address(0), amount, memo);
    }

    function sendTokenPayout(address token, address recipient, uint256 amount, bytes32 memo)
        external
        onlyOwner
    {
        if (token == address(0) || recipient == address(0) || amount == 0) {
            revert InvalidInput();
        }
        bool ok = IERC20Like(token).transfer(recipient, amount);
        if (!ok) revert TokenTransferFailed();
        emit PayoutSent(recipient, token, amount, memo);
    }
}
