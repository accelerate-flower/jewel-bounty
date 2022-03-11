// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

/// INTERFACES ///
import "./heroes/interfaces/IJewelToken8.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title JewelDisburse
/// @author Accelerate Flower - Code Test
/// @dev Functionality that supports paying fees.
contract JewelDisburse is Initializable {
    /// CONTRACTS ///
    IJewelToken jewelToken;

    /// TYPES ///
    struct Disbursement {
        uint256 id;
        address recipient;
        uint256 total;
        uint256 claimed;
        uint256 balance;
        uint64 createdTime;
        uint64 startTime;
        uint64 endTime;
        uint8 status;
    }

    /// STATE ///
    address private _owner;
    uint private _disbursementId;
    // Map an address to their disbursements.
    mapping(address => Disbursement[]) public disbursements;

    /// EVENTS ///
    event DisbursementAdded(address recipient, uint256 amount, uint64 startTime, uint64 endTime);
    event DisbursementClaim(uint256 disbursementId, address recipient, uint256 amount);

    // Using the owner, but realistically would probably use the 
    // openzeppelin access controls for a more full fledged implmentation.
    modifier onlyAdmin() {
        require(_owner == msg.sender, "Only admin can call");
        _;
    }


    function initialize(address _jewelAddress) public initializer {
        jewelToken = IJewelToken(_jewelAddress);
        _disbursementId = 1;
        _owner = msg.sender;
    }

    function addDisbursement(
        address _recipient,
        uint256 _amount,
        uint64 _startTime,
        uint64 _endTime
    ) external onlyAdmin {
        disbursements[_recipient].push(Disbursement(_disbursementId++, _recipient, _amount, 0, _amount, uint64(block.timestamp), _startTime, _endTime, 1));
        emit DisbursementAdded(_recipient, _amount, _startTime, _endTime);
    }

    function getDisbursements(address _recipient) public view returns (Disbursement[] memory) {
        return disbursements[_recipient];
    }

    // Return the total unclaimed, vested tokens which a recipient can claim.
    function totalVested(address _recipient) public view returns (uint256) {
        uint256 total = 0;
        for (uint256 j = 0; j < disbursements[_recipient].length; j++) {
            total += totalVestedDisbursement(disbursements[_recipient][j]);
        }
        return total;
    }

    // Return the total unclaimed, vested tokens that can be claimed.
    function totalVestedDisbursement(Disbursement memory _disbursement) public view returns (uint256) {
        uint256 addedAmount = 0;
        // Fully vested.
        if (_disbursement.endTime <= block.timestamp) {
            addedAmount = _disbursement.balance;
        }
        // Partially vested.
        else if (_disbursement.startTime < block.timestamp) {
            // disbursement amount * seconds completed / total seconds
            addedAmount = _disbursement.total * (block.timestamp - _disbursement.startTime) / (_disbursement.endTime - _disbursement.startTime);
            // Remove any already claimed tokens from this disbursement.
            addedAmount -= _disbursement.claimed;
        }

        return addedAmount;
    }

    // Return the total unclaimed tokens which a recipient cannot currently claim.
    function totalUnclaimed(address _recipient) public view returns (uint256) {
        uint256 total = 0;
        for (uint256 j = 0; j < disbursements[_recipient].length; j++) {
            uint256 addedAmount = 0;
            // Vesting has not started.
            if (disbursements[_recipient][j].startTime > block.timestamp) {
                addedAmount = disbursements[_recipient][j].balance;
            }
            // Partially vested.
            else if (disbursements[_recipient][j].endTime > block.timestamp) {
                // disbursement amount - (disbursement amount * seconds completed / total seconds)
                addedAmount = disbursements[_recipient][j].total - disbursements[_recipient][j].total * (block.timestamp - disbursements[_recipient][j].startTime) / (disbursements[_recipient][j].endTime - disbursements[_recipient][j].startTime);
            }
            total += addedAmount;
        }
        return total;
    }

    // Return the total tokens a recipient has claimed.
    function totalClaimed(address _recipient) public view returns (uint256) {
        uint256 total = 0;
        for (uint256 j = 0; j < disbursements[_recipient].length; j++) {
            total += disbursements[_recipient][j].claimed;
        }
        return total;
    }

    // Claim _amount tokens from the msg.sender's totalVested balance, ensuring they can't claim more than
    // have vested, and transfers them to their address, while updating the totalVested, totalClaimed, etc.
    // Note that claiming should loop through disbursements, claiming as much as it can from one before moving
    // to the next.
    function claim(uint256 _amount) public {
        uint256 vestedAmount = 0;
        for (uint256 j = 0; j < disbursements[msg.sender].length; j++) {
            // Everything is claimed.
            if (disbursements[msg.sender][j].balance == 0) {
                continue;
            }
            vestedAmount = totalVestedDisbursement(disbursements[msg.sender][j]);
            if (vestedAmount > 0) {
                if (vestedAmount > _amount) {
                    vestedAmount = _amount;
                }

                require(jewelToken.transfer(msg.sender, vestedAmount), "Failed to transfer jewels");

                disbursements[msg.sender][j].claimed += vestedAmount;
                disbursements[msg.sender][j].balance -= vestedAmount;
                if (disbursements[msg.sender][j].balance == 0) {
                    disbursements[msg.sender][j].status = 0;
                }

                emit DisbursementClaim(disbursements[msg.sender][j].id, msg.sender, vestedAmount);
                _amount -= vestedAmount;

                // Fully emitted their request.
                if (_amount == 0) {
                    break;
                }
            }
        }
    }
}
