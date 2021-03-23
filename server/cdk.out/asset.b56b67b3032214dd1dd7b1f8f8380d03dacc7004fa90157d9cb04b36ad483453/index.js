"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = require("aws-sdk");
const crypto_1 = require("crypto");
const dynamoClient = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.DYNAMO_TABLE_NAME;
exports.handler = async (event, context) => {
    try {
        if (event["detail-type"] === "addReport") {
            console.log("detail===>", JSON.stringify(event.detail, null, 2));
            const params = {
                TableName: TABLE_NAME,
                Item: {
                    id: crypto_1.randomBytes(4).toString("hex"),
                    ...event.detail,
                },
            };
            await dynamoClient.put(params).promise();
        }
    }
    catch (err) {
        console.log(err);
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUNBLCtCQUErQjtBQUUvQixtQ0FBcUM7QUFHckMsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRSxDQUFDO0FBQ3ZELE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQTJCLENBQUM7QUFFM0QsT0FBTyxDQUFDLE9BQU8sR0FBRyxLQUFLLEVBQUUsS0FBb0MsRUFBRSxPQUFnQixFQUFFLEVBQUU7SUFFL0UsSUFBSTtRQUNBLElBQUksS0FBSyxDQUFDLGFBQWEsQ0FBQyxLQUFLLFdBQVcsRUFBRTtZQUV0QyxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFakUsTUFBTSxNQUFNLEdBQUc7Z0JBQ1gsU0FBUyxFQUFFLFVBQVU7Z0JBQ3JCLElBQUksRUFBRTtvQkFDRixFQUFFLEVBQUUsb0JBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO29CQUNsQyxHQUFHLEtBQUssQ0FBQyxNQUFNO2lCQUNsQjthQUNKLENBQUM7WUFDRixNQUFNLFlBQVksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7U0FDNUM7S0FFSjtJQUNELE9BQU8sR0FBRyxFQUFFO1FBQ1IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtLQUNuQjtBQUNMLENBQUMsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50QnJpZGdlRXZlbnQsIENvbnRleHQgfSBmcm9tIFwiYXdzLWxhbWJkYVwiO1xyXG5pbXBvcnQgKiBhcyBBV1MgZnJvbSBcImF3cy1zZGtcIjtcclxuXHJcbmltcG9ydCB7IHJhbmRvbUJ5dGVzIH0gZnJvbSAnY3J5cHRvJztcclxuXHJcblxyXG5jb25zdCBkeW5hbW9DbGllbnQgPSBuZXcgQVdTLkR5bmFtb0RCLkRvY3VtZW50Q2xpZW50KCk7XHJcbmNvbnN0IFRBQkxFX05BTUUgPSBwcm9jZXNzLmVudi5EWU5BTU9fVEFCTEVfTkFNRSBhcyBzdHJpbmc7XHJcblxyXG5leHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQ6IEV2ZW50QnJpZGdlRXZlbnQ8c3RyaW5nLCBhbnk+LCBjb250ZXh0OiBDb250ZXh0KSA9PiB7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgICBpZiAoZXZlbnRbXCJkZXRhaWwtdHlwZVwiXSA9PT0gXCJhZGRSZXBvcnRcIikge1xyXG5cclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJkZXRhaWw9PT0+XCIsIEpTT04uc3RyaW5naWZ5KGV2ZW50LmRldGFpbCwgbnVsbCwgMikpO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0ge1xyXG4gICAgICAgICAgICAgICAgVGFibGVOYW1lOiBUQUJMRV9OQU1FLFxyXG4gICAgICAgICAgICAgICAgSXRlbToge1xyXG4gICAgICAgICAgICAgICAgICAgIGlkOiByYW5kb21CeXRlcyg0KS50b1N0cmluZyhcImhleFwiKSxcclxuICAgICAgICAgICAgICAgICAgICAuLi5ldmVudC5kZXRhaWwsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBhd2FpdCBkeW5hbW9DbGllbnQucHV0KHBhcmFtcykucHJvbWlzZSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coZXJyKVxyXG4gICAgfVxyXG59Il19