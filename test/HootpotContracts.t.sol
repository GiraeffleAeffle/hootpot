// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { HootpotMerchantRegistry } from "../contracts/HootpotMerchantRegistry.sol";
import { HootpotPrizePool } from "../contracts/HootpotPrizePool.sol";
import { HootpotReceiptRegistry } from "../contracts/HootpotReceiptRegistry.sol";

interface Vm {
    function roll(uint256 newHeight) external;
}

contract MockToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "balance");
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract HootpotContractsTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant OWNER = address(0xA11CE);
    address private constant MERCHANT = address(0xB0B);
    address private constant PAYER = address(0xCAFE);
    address private constant WINNER = address(0xDAD);

    receive() external payable {}

    function testMerchantRegistryStoresOnlyOwnerConfiguredMerchants() external {
        HootpotMerchantRegistry registry = new HootpotMerchantRegistry(address(this));
        bytes32 merchantId = keccak256("owl-coffee");
        bytes32 metadataHash = keccak256("ipfs://hootpot/owl-coffee");

        registry.setMerchant(merchantId, MERCHANT, metadataHash, true);

        assertEq(registry.merchantCount(), 1);
        assertEq(registry.merchantIdAt(0), merchantId);
        assertEq(registry.requireActiveMerchant(merchantId), MERCHANT);

        registry.setMerchant(merchantId, MERCHANT, metadataHash, false);
        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(registry.requireActiveMerchant.selector, merchantId)
        );
        require(!ok, "inactive merchant should revert");
    }

    function testReceiptRegistryDrawsAndRecordsPayoutProof() external {
        HootpotReceiptRegistry registry = new HootpotReceiptRegistry(address(this));

        bytes32 firstReceipt = registry.registerReceipt(
            1,
            PAYER,
            MERCHANT,
            1 ether,
            keccak256("payment-a"),
            keccak256("receipt-a")
        );
        bytes32 secondReceipt = registry.registerReceipt(
            1,
            WINNER,
            MERCHANT,
            2 ether,
            keccak256("payment-b"),
            keccak256("receipt-b")
        );

        assertEq(registry.receiptCount(1), 2);
        assertEq(registry.receiptAt(1, 0), firstReceipt);
        assertEq(registry.receiptAt(1, 1), secondReceipt);

        registry.closeRound(1, block.number + 1);
        (bool tooEarly,) = address(registry).call(abi.encodeWithSelector(registry.drawRound.selector, 1));
        require(!tooEarly, "draw should wait for draw block");

        vm.roll(block.number + 2);
        (bytes32 winnerReceiptId, address winner) = registry.drawRound(1);
        require(winner == PAYER || winner == WINNER, "winner not from receipts");
        require(winnerReceiptId == firstReceipt || winnerReceiptId == secondReceipt, "bad receipt");

        registry.recordPayout(1, address(0), 1 ether, keccak256("payout-tx"));

        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(
                registry.registerReceipt.selector,
                1,
                PAYER,
                MERCHANT,
                1 ether,
                keccak256("payment-c"),
                keccak256("receipt-c")
            )
        );
        require(!ok, "closed round should reject receipts");
    }

    function testPrizePoolFundsAndPaysNative() external {
        HootpotPrizePool pool = new HootpotPrizePool(address(this), address(1), address(2));

        pool.fundNative{ value: 2 ether }(keccak256("native-funding"));
        assertEq(address(pool).balance, 2 ether);

        uint256 beforeBalance = address(this).balance;
        pool.sendNativePayout(payable(address(this)), 1 ether, keccak256("native-payout"));

        assertEq(address(pool).balance, 1 ether);
        assertEq(address(this).balance, beforeBalance + 1 ether);
    }

    function testPrizePoolFundsAndPaysToken() external {
        MockToken token = new MockToken();
        HootpotPrizePool pool = new HootpotPrizePool(address(this), address(1), address(2));

        token.mint(address(this), 100);
        token.approve(address(pool), 100);
        pool.fundToken(address(token), 60, keccak256("token-funding"));

        assertEq(token.balanceOf(address(pool)), 60);
        pool.sendTokenPayout(address(token), WINNER, 25, keccak256("token-payout"));
        assertEq(token.balanceOf(WINNER), 25);
        assertEq(token.balanceOf(address(pool)), 35);
    }

    function assertEq(address actual, address expected) private pure {
        require(actual == expected, "address mismatch");
    }

    function assertEq(bytes32 actual, bytes32 expected) private pure {
        require(actual == expected, "bytes32 mismatch");
    }

    function assertEq(uint256 actual, uint256 expected) private pure {
        require(actual == expected, "uint256 mismatch");
    }
}
