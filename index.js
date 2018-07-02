'use strict';

const aws  = require("aws-sdk");
const uuid = require("uuid");
const jwtDecode = require('jwt-decode');

const accessKeyId     = process.env.ACCESS_KEY_ID;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;
const bucketName      = "is09-portal-image";
const roleArn         = "arn:aws:iam::278847671089:role/create-upload-to-s3-key-role";
const roleSessionName = "session_create-upload-to-s3-key-role";
const publicOrigin    = "https://s3-ap-northeast-1.amazonaws.com"

const sts = new aws.STS({
    "accessKeyId"    : accessKeyId,
    "secretAccessKey": secretAccessKey
});

module.exports.handler = (event, context, callback) => {
    const decodedJwt = jwtDecode(event.headers.Authorization);

    const {
        userId,
        type, // work | profile
        mimetype
    } = event.queryStringParameters;
    
    const err = null;

    if (decodedJwt !== userId)
        err = "You can not change other than yourself"

    if (!userId)
        err = "filename param is required";

    if (!mimetype)
        err = "mimetype param is required";
    
    if (!type)
        err = "type param is required";

    if (err) {
        callback(
            null,
            {
                statusCode: "400",
                body: JSON.stringify({ error: err }),
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
                    "Access-Control-Allow-Methods": "DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT",
                    "Access-Control-Allow-Origin" : "*"
                },
            }
        );
        return;
    }
    
    sts.assumeRole(
        {
            "RoleArn"        : roleArn,
            "RoleSessionName": roleSessionName
        },
        (err, data) => {
            
            if (err) {
                console.error(err);
                callback(
                    null, 
                    {
                        statusCode: "400",
                        body: JSON.stringify({ error: err }),
                        headers: {
                            "Content-Type": "application/json",
                            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
                            "Access-Control-Allow-Methods": "DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT",
                            "Access-Control-Allow-Origin" : "*"
                        },
                    }
                );
                return;
            };
            
            const s3 = new aws.S3({
                "accessKeyId"    : data.Credentials.AccessKeyId,
                "secretAccessKey": data.Credentials.SecretAccessKey,
                "sessionToken"   : data.Credentials.SessionToken
            });

            const fileName = uuid.v4();
            const key = (
                type === "work"    ? `users/${userId}/works/${fileName}`
              : type === "profile" ? `users/${userId}/profile/${fileName}`
              :                      `users/${userId}/tmp/${fileName}`
            )
            
            callback(
                null, 
                {
                    statusCode: "200",
                    body: JSON.stringify({ 
                        signedUrl: s3.getSignedUrl(
                            "putObject",
                            {Bucket: bucketName, Key: key, ContentType: mimetype}
                        ),
                        uploadedUrl: `${publicOrigin}/${bucketName}/${key}`
                    }),
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
                        "Access-Control-Allow-Methods": "DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT",
                        "Access-Control-Allow-Origin" : "*"
                    },
                }
            );
            return;
        }
    );
};
