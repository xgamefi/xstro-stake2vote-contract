//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./common.sol";

contract XstroClaim {
  address public authorizer;
  mapping(address => uint256) internal nonces;

  constructor(address _authorizer) {
    setAuthorizer(_authorizer);
  }

  event Claim(address sender, uint256 amount, uint256 nonce);
  event SetAuthorizer(address authorizer);

  function setAuthorizer(address _authorizer) public {
    authorizer = _authorizer;
    emit SetAuthorizer(_authorizer);
  }

  function _claim(
    uint256 _amount,
    uint256 _nonce,
    bytes32 _digest,
    bytes memory _signature
  ) internal {
    require(_amount > 0, "amount must be > 0");
    require(nonces[msg.sender] == _nonce, "invalid nonce");
    bytes32 digest = ECDSA.toEthSignedMessageHash(_getHash(_amount, _nonce));
    require(digest == _digest, "invalid digest");
    require(ECDSA.recover(_digest, _signature) == authorizer, "not authorized");
    nonces[msg.sender] += 1;
    (bool sent, ) = payable(msg.sender).call{ value: _amount }("");
    if (!sent) revert NativeTokenTransferError();
    emit Claim(msg.sender, _amount, _nonce);
  }

  function _getHash(uint256 _amount, uint256 _nonce) internal view returns (bytes32) {
    return keccak256(abi.encodePacked(msg.sender, _amount, _nonce));
  }

  function getNonce(address _address) public view returns (uint256) {
    return nonces[_address];
  }
}
