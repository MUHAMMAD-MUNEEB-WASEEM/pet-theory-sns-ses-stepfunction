import { EventBridgeEvent, Context } from "aws-lambda";
import * as AWS from "aws-sdk";

import { randomBytes } from 'crypto';




const dynamoClient = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.DYNAMO_TABLE_NAME as string;

exports.handler = async (event: EventBridgeEvent<string, any>, context: Context) => {
    const params = {
        TableName: TABLE_NAME,
        Item: {
            id: randomBytes(4).toString("hex"),
            ...event.detail,
        },
    };

    try {
        await dynamoClient.put(params).promise();
        return { operationSuccessful: true };
        }
        
    catch (err) {
        console.log("DynamoDB error: ", err);
        return { operationSuccessful: false };
    }
}