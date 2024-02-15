//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./common.sol";

contract XstroClaim {
  address public authorizer;
  mapping(address => uint256) nonces;

  constructor(address _authorizer) {
    authorizer = _authorizer;
  }

  event Claim(address sender, uint256 amount, uint256 nonce);

  function _claim(
    uint256 _amount,
    uint256 _nonce,
    bytes32 _digest,
    bytes memory _signature
  ) internal {
    require(nonces[msg.sender] == _nonce, "invalid nonce");
    bytes32 digest = ECDSA.toEthSignedMessageHash(_getHash(_amount, _nonce));
    require(digest == _digest, "invalid digest");
    require(ECDSA.recover(_digest, _signature) == authorizer, "not authorized");
    nonces[msg.sender] += 1;
    (bool sent, ) = payable(msg.sender).call{ value: _amount }("");
    if (!sent) revert NativeTokenTransferError();
    emit Claim(msg.sender, _amount, _nonce);
  }

  function _getHash(
    uint256 _amount,
    uint256 _nonce
  ) internal view returns (bytes32) {
    return keccak256(abi.encodePacked(msg.sender, _amount, _nonce));
  }
}
