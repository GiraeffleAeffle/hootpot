// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HootpotReceiptRegistry
/// @notice Records verified Hootpot receipts, deterministic draw results, and payout proofs.
/// @dev This contract is deliberately not a custody contract or Circles payment router.
contract HootpotReceiptRegistry {
    error NotOwner();
    error InvalidInput();
    error ReceiptAlreadyRegistered();
    error RoundAlreadyDrawn();
    error RoundAlreadyClosed();
    error RoundNotClosed();
    error RoundNotDrawn();
    error DrawBlockNotReady();
    error DrawBlockExpired();

    struct Receipt {
        uint64 roundId;
        address payer;
        address merchant;
        uint256 amountAttoCrc;
        bytes32 paymentTxHash;
        bytes32 receiptRefHash;
        uint64 registeredAt;
    }

    struct Round {
        bool closed;
        bool drawn;
        uint256 drawBlock;
        bytes32 seed;
        bytes32 winnerReceiptId;
        address winner;
        uint256 receiptCount;
    }

    address public owner;

    mapping(uint64 roundId => Round round) public rounds;
    mapping(bytes32 receiptId => Receipt receipt) public receipts;
    mapping(uint64 roundId => bytes32[] receiptIds) private roundReceipts;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ReceiptRegistered(
        uint64 indexed roundId,
        bytes32 indexed receiptId,
        address indexed payer,
        address merchant,
        uint256 amountAttoCrc,
        bytes32 paymentTxHash,
        bytes32 receiptRefHash
    );
    event RoundDrawn(
        uint64 indexed roundId,
        bytes32 indexed winnerReceiptId,
        address indexed winner,
        bytes32 seed,
        uint256 winnerIndex
    );
    event RoundClosed(uint64 indexed roundId, uint256 indexed drawBlock);
    event PayoutRecorded(
        uint64 indexed roundId,
        bytes32 indexed receiptId,
        address indexed winner,
        address payoutToken,
        uint256 amount,
        bytes32 payoutTxHash
    );

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert InvalidInput();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), owner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidInput();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function registerReceipt(
        uint64 roundId,
        address payer,
        address merchant,
        uint256 amountAttoCrc,
        bytes32 paymentTxHash,
        bytes32 receiptRefHash
    ) external onlyOwner returns (bytes32 receiptId) {
        if (
            roundId == 0 || payer == address(0) || merchant == address(0)
                || amountAttoCrc == 0 || paymentTxHash == bytes32(0)
                || receiptRefHash == bytes32(0)
        ) {
            revert InvalidInput();
        }
        if (rounds[roundId].closed) revert RoundAlreadyClosed();

        receiptId = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                roundId,
                payer,
                merchant,
                amountAttoCrc,
                paymentTxHash,
                receiptRefHash
            )
        );
        if (receipts[receiptId].registeredAt != 0) {
            revert ReceiptAlreadyRegistered();
        }

        receipts[receiptId] = Receipt({
            roundId: roundId,
            payer: payer,
            merchant: merchant,
            amountAttoCrc: amountAttoCrc,
            paymentTxHash: paymentTxHash,
            receiptRefHash: receiptRefHash,
            registeredAt: uint64(block.timestamp)
        });
        roundReceipts[roundId].push(receiptId);
        rounds[roundId].receiptCount = roundReceipts[roundId].length;

        emit ReceiptRegistered(
            roundId,
            receiptId,
            payer,
            merchant,
            amountAttoCrc,
            paymentTxHash,
            receiptRefHash
        );
    }

    function closeRound(uint64 roundId, uint256 drawBlock) external onlyOwner {
        Round storage round = rounds[roundId];
        if (round.closed) revert RoundAlreadyClosed();
        if (round.receiptCount == 0 || drawBlock <= block.number) revert InvalidInput();

        round.closed = true;
        round.drawBlock = drawBlock;

        emit RoundClosed(roundId, drawBlock);
    }

    function drawRound(uint64 roundId) external returns (bytes32 winnerReceiptId, address winner) {
        Round storage round = rounds[roundId];
        if (!round.closed) revert RoundNotClosed();
        if (round.drawn) revert RoundAlreadyDrawn();
        if (block.number <= round.drawBlock) revert DrawBlockNotReady();

        bytes32 seed = blockhash(round.drawBlock);
        if (seed == bytes32(0)) revert DrawBlockExpired();

        uint256 winnerIndex = uint256(keccak256(abi.encode(seed, roundId, round.receiptCount)))
            % round.receiptCount;
        winnerReceiptId = roundReceipts[roundId][winnerIndex];
        winner = receipts[winnerReceiptId].payer;

        round.drawn = true;
        round.seed = seed;
        round.winnerReceiptId = winnerReceiptId;
        round.winner = winner;

        emit RoundDrawn(roundId, winnerReceiptId, winner, seed, winnerIndex);
    }

    function recordPayout(
        uint64 roundId,
        address payoutToken,
        uint256 amount,
        bytes32 payoutTxHash
    ) external onlyOwner {
        Round memory round = rounds[roundId];
        if (!round.drawn) revert RoundNotDrawn();
        if (amount == 0 || payoutTxHash == bytes32(0)) revert InvalidInput();

        emit PayoutRecorded(
            roundId,
            round.winnerReceiptId,
            round.winner,
            payoutToken,
            amount,
            payoutTxHash
        );
    }

    function receiptCount(uint64 roundId) external view returns (uint256) {
        return roundReceipts[roundId].length;
    }

    function receiptAt(uint64 roundId, uint256 index) external view returns (bytes32) {
        return roundReceipts[roundId][index];
    }
}
