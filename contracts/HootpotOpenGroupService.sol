// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBaseGroupLike {
    function trustBatchWithConditions(address[] calldata members, uint96 expiry) external;
}

/// @title HootpotOpenGroupService
/// @notice BaseGroup service that lets any Circles avatar join the configured group.
/// @dev The HOOT group owner must set this contract as the group's service once.
contract HootpotOpenGroupService {
    error InvalidGroup();
    error InvalidMember();
    error MemberMustBeCaller();

    address public immutable group;

    event Joined(address indexed member);

    constructor(address group_) {
        if (group_ == address(0)) revert InvalidGroup();
        group = group_;
    }

    function join() external {
        _join(msg.sender);
    }

    function join(address member) external {
        if (member != msg.sender) revert MemberMustBeCaller();
        _join(member);
    }

    function _join(address member) internal {
        if (member == address(0)) revert InvalidMember();
        address[] memory members = new address[](1);
        members[0] = member;
        IBaseGroupLike(group).trustBatchWithConditions(members, type(uint96).max);
        emit Joined(member);
    }
}
