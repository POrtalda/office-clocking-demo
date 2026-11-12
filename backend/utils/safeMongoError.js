// Fixed allowlist only: never return message, stack, URI or arbitrary error fields.
function safeError(error) {
  const queue=[error],seen=new Set(),matches=[];
  const codes=new Map([[18,"AUTHENTICATION_FAILED"],[13,"PERMISSION_DENIED"],[50,"OPERATION_TIMEOUT"],[89,"NETWORK_FAILURE"],[91,"SERVER_UNAVAILABLE"],[262,"OPERATION_TIMEOUT"],[26,"NAMESPACE_NOT_FOUND"],[59,"COMMAND_UNSUPPORTED"],[115,"COMMAND_UNSUPPORTED"],[303,"COMMAND_UNSUPPORTED"]]);
  const systemCodes=new Map([
    ...["ENOTFOUND","EAI_AGAIN","ENODATA","ESERVFAIL","EREFUSED"].map(code=>[code,"DNS_FAILURE"]),
    ...["ETIMEOUT","ETIMEDOUT"].map(code=>[code,"OPERATION_TIMEOUT"]),
    ...["ECONNREFUSED","ECONNRESET","EHOSTUNREACH","ENETUNREACH","EPIPE"].map(code=>[code,"NETWORK_FAILURE"]),
    ...["CERT_HAS_EXPIRED","CERT_NOT_YET_VALID","DEPTH_ZERO_SELF_SIGNED_CERT","SELF_SIGNED_CERT_IN_CHAIN","UNABLE_TO_VERIFY_LEAF_SIGNATURE","UNABLE_TO_GET_ISSUER_CERT_LOCALLY","ERR_TLS_CERT_ALTNAME_INVALID","ERR_SSL_WRONG_VERSION_NUMBER"].map(code=>[code,"TLS_FAILURE"])
  ]);
  const names=new Map([["MongoServerSelectionError","SERVER_SELECTION_TIMEOUT"],["MongooseServerSelectionError","SERVER_SELECTION_TIMEOUT"],["MongoNetworkTimeoutError","OPERATION_TIMEOUT"],["MongoOperationTimeoutError","OPERATION_TIMEOUT"],["MongoWaitQueueTimeoutError","OPERATION_TIMEOUT"],["MongoNetworkError","NETWORK_FAILURE"],["MongoPoolClearedError","NETWORK_FAILURE"],["MongoTopologyClosedError","CLIENT_STATE_ERROR"],["MongoNotConnectedError","CLIENT_STATE_ERROR"],["MongoParseError","DRIVER_CONFIGURATION_ERROR"],["MongoInvalidArgumentError","DRIVER_CONFIGURATION_ERROR"],["TypeError","DIAGNOSTIC_TYPE_ERROR"],["ReferenceError","DIAGNOSTIC_REFERENCE_ERROR"]]);
  while(queue.length && seen.size<100) {
    const node=queue.shift();if(!node || typeof node!=="object" || seen.has(node))continue;seen.add(node);
    const code=typeof node.code==="string" && /^\d{1,5}$/.test(node.code)?Number(node.code):node.code;
    if(codes.has(code))matches.push({category:codes.get(code),errorCode:`MONGO_${code}`});
    if(typeof code==="string" && /^(ERR_TLS_|ERR_SSL_|CERT_)/.test(code) && !systemCodes.has(code))matches.push({category:"TLS_FAILURE",errorCode:"TLS_ERROR"});
    if(systemCodes.has(code))matches.push({category:systemCodes.get(code),errorCode:code});
    if(node.codeName==="AuthenticationFailed")matches.push({category:"AUTHENTICATION_FAILED",errorCode:"MONGO_18"});
    if(node.codeName==="Unauthorized")matches.push({category:"PERMISSION_DENIED",errorCode:"MONGO_13"});
    // Atlas sometimes wraps auth/authorization failures in code 8000. Inspect fixed
    // patterns in memory only; never return message, codeName, stack or arbitrary codes.
    if(code===8000) {
      const text=[node.message,node.errmsg].filter(value=>typeof value==="string").join(" ");
      const patterns=[
        [/authentication failed|bad auth|unable to authenticate|auth failed/i,"AUTHENTICATION_FAILED"],
        [/not authorized|unauthorized|not allowed to (?:do action|execute)|permission denied|not permitted|requires authentication|insufficient privileges/i,"PERMISSION_DENIED"],
        [/CMD_NOT_ALLOWED|command.*not (?:allowed|supported)|not supported.*(?:tier|atlas)|unsupported command|not allowed.*(?:tier|cluster)/i,"COMMAND_UNSUPPORTED"],
        [/already exists.*different case|different case.*already|database.*case.*conflict/i,"DATABASE_CASE_CONFLICT"],
        [/quota|storage limit|space quota|exceeded.*limit|too many.*(?:database|collection)/i,"ATLAS_QUOTA_LIMIT"],
        [/cluster.*(?:paused|suspended|unavailable)|temporarily unavailable|maintenance/i,"SERVER_UNAVAILABLE"],
        [/database name.*(?:too long|length)|db name.*(?:length|long)|(?:max|maximum).*(?:db|database).*name.*(?:length|bytes)/i,"DATABASE_NAME_TOO_LONG"],
        [/invalid.*database|database.*(?:invalid|not found|does not exist)|empty database name/i,"ATLAS_DATABASE_ERROR"]
      ];
      let category=patterns.find(([pattern])=>pattern.test(text))?.[1] || "ATLAS_SERVER_ERROR";
      if(category==="DATABASE_NAME_TOO_LONG" && /\b38\b/.test(text)) category="DATABASE_NAME_EXCEEDS_38_BYTES";
      matches.push({category,errorCode:"MONGO_8000"});
    }
    if(names.has(node.name))matches.push({category:names.get(node.name),errorCode:node.name==="TypeError"?"TYPE_ERROR":node.name==="ReferenceError"?"REFERENCE_ERROR":node.name});
    for(const key of ["cause","reason","error","originalError","errorResponse","result","response"])queue.push(node[key]);
    for(const value of [node.servers,node.errors,node.writeErrors]) {
      if(value instanceof Map)queue.push(...value.values());else if(Array.isArray(value))queue.push(...value);else if(value && typeof value==="object")queue.push(...Object.values(value));
    }
  }
  const priority=["AUTHENTICATION_FAILED","PERMISSION_DENIED","DNS_FAILURE","TLS_FAILURE","DIAGNOSTIC_TYPE_ERROR","DIAGNOSTIC_REFERENCE_ERROR","NAMESPACE_NOT_FOUND","COMMAND_UNSUPPORTED","DATABASE_CASE_CONFLICT","ATLAS_QUOTA_LIMIT","ATLAS_DATABASE_ERROR","DATABASE_NAME_TOO_LONG","DATABASE_NAME_EXCEEDS_38_BYTES","ATLAS_SERVER_ERROR","DRIVER_CONFIGURATION_ERROR","OPERATION_TIMEOUT","NETWORK_FAILURE","SERVER_UNAVAILABLE","CLIENT_STATE_ERROR","SERVER_SELECTION_TIMEOUT"];
  for(const category of priority){const match=matches.find(item=>item.category===category);if(match)return match;}
  return {category:"UNCLASSIFIED_FAILURE",errorCode:"UNKNOWN"};
}
module.exports={safeError};
