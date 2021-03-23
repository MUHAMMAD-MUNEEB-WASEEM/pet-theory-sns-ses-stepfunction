"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerStack = void 0;
const cdk = require("@aws-cdk/core");
const lambda = require("@aws-cdk/aws-lambda");
const apigw = require("@aws-cdk/aws-apigateway");
const events = require("@aws-cdk/aws-events");
const ddb = require("@aws-cdk/aws-dynamodb");
const appsync = require("@aws-cdk/aws-appsync");
const targets = require("@aws-cdk/aws-events-targets");
const response_request_1 = require("../response-request");
const aws_events_1 = require("@aws-cdk/aws-events");
const aws_iam_1 = require("@aws-cdk/aws-iam");
const stepFunctions = require("@aws-cdk/aws-stepfunctions");
const stepFunctionTasks = require("@aws-cdk/aws-stepfunctions-tasks");
const subscriptions = require("@aws-cdk/aws-sns-subscriptions");
const sns = require("@aws-cdk/aws-sns");
const sqs = require("@aws-cdk/aws-sqs");
class ServerStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // The code that defines your stack goes here
        // API
        const apiGateway = new appsync.GraphqlApi(this, "Api", {
            name: "appsyncEventbridgeAPI",
            schema: appsync.Schema.fromAsset("graphql/schema.gql"),
            authorizationConfig: {
                defaultAuthorization: {
                    authorizationType: appsync.AuthorizationType.API_KEY,
                },
            },
        });
        const petTheoryTable = new ddb.Table(this, 'CDKPetTable', {
            partitionKey: {
                name: 'id',
                type: ddb.AttributeType.STRING,
            },
        });
        // DYANAMO AS DS
        const ddbAsDS = apiGateway.addDynamoDbDataSource("thePetTable", petTheoryTable);
        ddbAsDS.createResolver({
            typeName: "Query",
            fieldName: "getReports",
            requestMappingTemplate: appsync.MappingTemplate.dynamoDbScanTable(),
            responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
        });
        // HTTP DATASOURCE
        const httpDs = apiGateway.addHttpDataSource("ds", "https://events." + this.region + ".amazonaws.com/", // This is the ENDPOINT for eventbridge.
        {
            name: "httpDsWithEventBridge",
            description: "From Appsync to Eventbridge",
            authorizationConfig: {
                signingRegion: this.region,
                signingServiceName: "events",
            },
        });
        events.EventBus.grantPutEvents(httpDs);
        // RESOLVERS
        const mutations = ["addReport"];
        mutations.forEach((mutation) => {
            let details = `\\\"id\\\": \\\"$ctx.args.id\\\"`;
            if (mutation === "addReport") {
                details = `\\\"name\\\":\\\"$ctx.args.report.name\\\" , \\\"email\\\":\\\"$ctx.args.report.email\\\" , \\\"message\\\":\\\"$ctx.args.report.message\\\"`;
            }
            httpDs.createResolver({
                typeName: "Mutation",
                fieldName: mutation,
                requestMappingTemplate: appsync.MappingTemplate.fromString(response_request_1.requestTemplate(details, mutation)),
                responseMappingTemplate: appsync.MappingTemplate.fromString(response_request_1.responseTemplate()),
            });
        });
        const addLambda = new lambda.Function(this, 'AppSyncNotesHandler', {
            runtime: lambda.Runtime.NODEJS_12_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('functions'),
            memorySize: 1024,
            environment: {
                DYNAMO_TABLE_NAME: petTheoryTable.tableName,
            },
        });
        petTheoryTable.grantReadWriteData(addLambda);
        petTheoryTable.grantFullAccess(addLambda);
        addLambda.addEnvironment("DynamoTable", petTheoryTable.tableName);
        // RULE
        const rule = new aws_events_1.Rule(this, "the-Ruleee", {
            ruleName: "Rulesforpet",
            eventPattern: {
                source: ["PetEvents"],
            },
        });
        //adding target 
        rule.addTarget(new targets.LambdaFunction(addLambda));
        // Creating a IAM role for lambda to give access of ses send email
        const role = new aws_iam_1.Role(this, 'LambdaRole', {
            assumedBy: new aws_iam_1.ServicePrincipal('lambda.amazonaws.com'),
        });
        ///Attaching ses access to policy
        const policy = new aws_iam_1.PolicyStatement({
            effect: aws_iam_1.Effect.ALLOW,
            actions: ["ses:SendEmail", "ses:SendRawEmail", "logs:*"],
            resources: ['*']
        });
        //granting IAM permissions to role
        role.addToPolicy(policy);
        //  Creating send email lambda handler
        const emailSender = new lambda.Function(this, "HandleSendEmail", {
            runtime: lambda.Runtime.NODEJS_10_X,
            code: lambda.Code.fromAsset("fns-lambda"),
            handler: "lambda.handler",
            role: role
        });
        // create the API Gateway with one method and path For lambda
        const api = new apigw.RestApi(this, "SendEmailEndPoint");
        api
            .root
            .resourceForPath("sendmail")
            .addMethod("POST", new apigw.LambdaIntegration(emailSender));
        // logging api endpoint
        new cdk.CfnOutput(this, 'Send email endpoint', {
            value: `${api.url}sendmail`
        });
        //STEPS
        const firstStep = new stepFunctionTasks.LambdaInvoke(this, "Invoke addData lambda", {
            lambdaFunction: emailSender,
        });
        const secondStep = new stepFunctionTasks.LambdaInvoke(this, "Invoke ses lambda", {
            lambdaFunction: addLambda,
        });
        const chain = stepFunctions.Chain.start(firstStep).next(secondStep);
        // create a state machine
        const stepFn = new stepFunctions.StateMachine(this, "stateMachineEventDriven", {
            definition: chain,
        });
        rule.addTarget(new targets.SfnStateMachine(stepFn));
        // create an SNS topic
        const myTopic = new sns.Topic(this, "MyTopic");
        // create a dead letter queue
        const dlQueue = new sqs.Queue(this, "DeadLetterQueue", {
            queueName: "MySubscription_DLQ",
            retentionPeriod: cdk.Duration.days(14),
        });
        // subscribe SMS number to the topic
        myTopic.addSubscription(new subscriptions.SmsSubscription("+923158564614", {
            deadLetterQueue: dlQueue,
        }));
        rule.addTarget(new targets.SnsTopic(myTopic));
        // Prints out the AppSync GraphQL endpoint to the terminal
        new cdk.CfnOutput(this, "GraphQLAPIURL", {
            value: apiGateway.graphqlUrl
        });
        // Prints out the AppSync GraphQL API key to the terminal
        new cdk.CfnOutput(this, "GraphQLAPIKey", {
            value: apiGateway.apiKey || ''
        });
        // Prints out the stack region to the terminal
        new cdk.CfnOutput(this, "Stack Region", {
            value: this.region
        });
    }
}
exports.ServerStack = ServerStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFDQUFxQztBQUNyQyw4Q0FBOEM7QUFDOUMsaURBQWlEO0FBQ2pELDhDQUE4QztBQUM5Qyw2Q0FBNkM7QUFDN0MsZ0RBQWdEO0FBQ2hELHVEQUF1RDtBQUN2RCwwREFBd0U7QUFDeEUsb0RBQTJDO0FBQzNDLDhDQUFtRjtBQUNuRiw0REFBNEQ7QUFDNUQsc0VBQXNFO0FBQ3RFLGdFQUFnRTtBQUNoRSx3Q0FBd0M7QUFDeEMsd0NBQXdDO0FBRXhDLE1BQWEsV0FBWSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3hDLFlBQVksS0FBb0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDbEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsNkNBQTZDO1FBQzdDLE1BQU07UUFDTixNQUFNLFVBQVUsR0FBRyxJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRTtZQUNyRCxJQUFJLEVBQUUsdUJBQXVCO1lBQzdCLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQztZQUN0RCxtQkFBbUIsRUFBRTtnQkFDbkIsb0JBQW9CLEVBQUU7b0JBQ3BCLGlCQUFpQixFQUFFLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO2lCQUVyRDthQUNGO1NBRUYsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDeEQsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxJQUFJO2dCQUNWLElBQUksRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDL0I7U0FDRixDQUFDLENBQUM7UUFFSCxnQkFBZ0I7UUFDaEIsTUFBTSxPQUFP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RTtZQUN2QyxLQUFLLEVBQUUsVUFBVSxDQUFDLFVBQVU7U0FDN0IsQ0FBQyxDQUFDO1FBRUgseURBQXlEO1FBQ3pELElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxVQUFVLENBQUMsTUFBTSxJQUFJLEVBQUU7U0FDL0IsQ0FBQyxDQUFDO1FBRUgsOENBQThDO1FBQzlDLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3RDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTTtTQUNuQixDQUFDLENBQUM7SUFHTCxDQUFDO0NBRUY7QUFsTUQsa0NBa01DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSBcIkBhd3MtY2RrL2F3cy1sYW1iZGFcIjtcclxuaW1wb3J0ICogYXMgYXBpZ3cgZnJvbSBcIkBhd3MtY2RrL2F3cy1hcGlnYXRld2F5XCI7XHJcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tIFwiQGF3cy1jZGsvYXdzLWV2ZW50c1wiO1xyXG5pbXBvcnQgKiBhcyBkZGIgZnJvbSAnQGF3cy1jZGsvYXdzLWR5bmFtb2RiJztcclxuaW1wb3J0ICogYXMgYXBwc3luYyBmcm9tIFwiQGF3cy1jZGsvYXdzLWFwcHN5bmNcIjtcclxuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tIFwiQGF3cy1jZGsvYXdzLWV2ZW50cy10YXJnZXRzXCI7XHJcbmltcG9ydCB7IHJlcXVlc3RUZW1wbGF0ZSwgcmVzcG9uc2VUZW1wbGF0ZSB9IGZyb20gXCIuLi9yZXNwb25zZS1yZXF1ZXN0XCI7XHJcbmltcG9ydCB7IFJ1bGUgfSBmcm9tICdAYXdzLWNkay9hd3MtZXZlbnRzJztcclxuaW1wb3J0IHsgRWZmZWN0LCBQb2xpY3lTdGF0ZW1lbnQsIFJvbGUsIFNlcnZpY2VQcmluY2lwYWwgfSBmcm9tICdAYXdzLWNkay9hd3MtaWFtJztcclxuaW1wb3J0ICogYXMgc3RlcEZ1bmN0aW9ucyBmcm9tIFwiQGF3cy1jZGsvYXdzLXN0ZXBmdW5jdGlvbnNcIjtcclxuaW1wb3J0ICogYXMgc3RlcEZ1bmN0aW9uVGFza3MgZnJvbSBcIkBhd3MtY2RrL2F3cy1zdGVwZnVuY3Rpb25zLXRhc2tzXCI7XHJcbmltcG9ydCAqIGFzIHN1YnNjcmlwdGlvbnMgZnJvbSBcIkBhd3MtY2RrL2F3cy1zbnMtc3Vic2NyaXB0aW9uc1wiO1xyXG5pbXBvcnQgKiBhcyBzbnMgZnJvbSBcIkBhd3MtY2RrL2F3cy1zbnNcIjtcclxuaW1wb3J0ICogYXMgc3FzIGZyb20gXCJAYXdzLWNkay9hd3Mtc3FzXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgU2VydmVyU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICAvLyBUaGUgY29kZSB0aGF0IGRlZmluZXMgeW91ciBzdGFjayBnb2VzIGhlcmVcclxuICAgIC8vIEFQSVxyXG4gICAgY29uc3QgYXBpR2F0ZXdheSA9IG5ldyBhcHBzeW5jLkdyYXBocWxBcGkodGhpcywgXCJBcGlcIiwge1xyXG4gICAgICBuYW1lOiBcImFwcHN5bmNFdmVudGJyaWRnZUFQSVwiLFxyXG4gICAgICBzY2hlbWE6IGFwcHN5bmMuU2NoZW1hLmZyb21Bc3NldChcImdyYXBocWwvc2NoZW1hLmdxbFwiKSxcclxuICAgICAgYXV0aG9yaXphdGlvbkNvbmZpZzoge1xyXG4gICAgICAgIGRlZmF1bHRBdXRob3JpemF0aW9uOiB7XHJcbiAgICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBwc3luYy5BdXRob3JpemF0aW9uVHlwZS5BUElfS0VZLFxyXG4gICAgICAgICBcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgIFxyXG4gICAgfSk7XHJcbiAgICBjb25zdCBwZXRUaGVvcnlUYWJsZSA9IG5ldyBkZGIuVGFibGUodGhpcywgJ0NES1BldFRhYmxlJywge1xyXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcclxuICAgICAgICBuYW1lOiAnaWQnLFxyXG4gICAgICAgIHR5cGU6IGRkYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIERZQU5BTU8gQVMgRFNcclxuICAgIGNvbnN0IGRkYkFzRFMgPSBhcGlHYXRld2F5LmFkZER5bmFtb0RiRGF0YVNvdXJjZShcInRoZVBldFRhYmxlXCIsIHBldFRoZW9yeVRhYmxlKTtcclxuXHJcbiAgICBkZGJBc0RTLmNyZWF0ZVJlc29sdmVyKHtcclxuICAgICAgdHlwZU5hbWU6IFwiUXVlcnlcIixcclxuICAgICAgZmllbGROYW1lOiBcImdldFJlcG9ydHNcIixcclxuICAgICAgcmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogYXBwc3luYy5NYXBwaW5nVGVtcGxhdGUuZHluYW1vRGJTY2FuVGFibGUoKSxcclxuICAgICAgcmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6IGFwcHN5bmMuTWFwcGluZ1RlbXBsYXRlLmR5bmFtb0RiUmVzdWx0TGlzdCgpLFxyXG4gICAgfSlcclxuXHJcbiAgICAvLyBIVFRQIERBVEFTT1VSQ0VcclxuICAgIGNvbnN0IGh0dHBEcyA9IGFwaUdhdGV3YXkuYWRkSHR0cERhdGFTb3VyY2UoXHJcbiAgICAgIFwiZHNcIixcclxuICAgICAgXCJodHRwczovL2V2ZW50cy5cIiArIHRoaXMucmVnaW9uICsgXCIuYW1hem9uYXdzLmNvbS9cIiwgLy8gVGhpcyBpcyB0aGUgRU5EUE9JTlQgZm9yIGV2ZW50YnJpZGdlLlxyXG4gICAgICB7XHJcbiAgICAgICAgbmFtZTogXCJodHRwRHNXaXRoRXZlbnRCcmlkZ2VcIixcclxuICAgICAgICBkZXNjcmlwdGlvbjogXCJGcm9tIEFwcHN5bmMgdG8gRXZlbnRicmlkZ2VcIixcclxuICAgICAgICBhdXRob3JpemF0aW9uQ29uZmlnOiB7XHJcbiAgICAgICAgICBzaWduaW5nUmVnaW9uOiB0aGlzLnJlZ2lvbixcclxuICAgICAgICAgIHNpZ25pbmdTZXJ2aWNlTmFtZTogXCJldmVudHNcIixcclxuICAgICAgICB9LFxyXG4gICAgICB9XHJcbiAgICApO1xyXG4gICAgZXZlbnRzLkV2ZW50QnVzLmdyYW50UHV0RXZlbnRzKGh0dHBEcyk7XHJcbiAgICAvLyBSRVNPTFZFUlNcclxuICAgIGNvbnN0IG11dGF0aW9ucyA9IFtcImFkZFJlcG9ydFwiXVxyXG5cclxuICAgIG11dGF0aW9ucy5mb3JFYWNoKChtdXRhdGlvbikgPT4ge1xyXG4gICAgICBsZXQgZGV0YWlscyA9IGBcXFxcXFxcImlkXFxcXFxcXCI6IFxcXFxcXFwiJGN0eC5hcmdzLmlkXFxcXFxcXCJgO1xyXG5cclxuICAgICAgaWYgKG11dGF0aW9uID09PSBcImFkZFJlcG9ydFwiKSB7XHJcbiAgICAgICAgZGV0YWlscyA9IGBcXFxcXFxcIm5hbWVcXFxcXFxcIjpcXFxcXFxcIiRjdHguYXJncy5yZXBvcnQubmFtZVxcXFxcXFwiICwgXFxcXFxcXCJlbWFpbFxcXFxcXFwiOlxcXFxcXFwiJGN0eC5hcmdzLnJlcG9ydC5lbWFpbFxcXFxcXFwiICwgXFxcXFxcXCJtZXNzYWdlXFxcXFxcXCI6XFxcXFxcXCIkY3R4LmFyZ3MucmVwb3J0Lm1lc3NhZ2VcXFxcXFxcImA7XHJcblxyXG4gICAgICB9XHJcblxyXG4gICAgICBodHRwRHMuY3JlYXRlUmVzb2x2ZXIoe1xyXG4gICAgICAgIHR5cGVOYW1lOiBcIk11dGF0aW9uXCIsXHJcbiAgICAgICAgZmllbGROYW1lOiBtdXRhdGlvbixcclxuICAgICAgICByZXF1ZXN0TWFwcGluZ1RlbXBsYXRlOiBhcHBzeW5jLk1hcHBpbmdUZW1wbGF0ZS5mcm9tU3RyaW5nKHJlcXVlc3RUZW1wbGF0ZShkZXRhaWxzLCBtdXRhdGlvbikpLFxyXG4gICAgICAgIHJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlOiBhcHBzeW5jLk1hcHBpbmdUZW1wbGF0ZS5mcm9tU3RyaW5nKHJlc3BvbnNlVGVtcGxhdGUoKSksXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgYWRkTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXBwU3luY05vdGVzSGFuZGxlcicsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzEyX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdmdW5jdGlvbnMnKSxcclxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBEWU5BTU9fVEFCTEVfTkFNRTogcGV0VGhlb3J5VGFibGUudGFibGVOYW1lLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgICBwZXRUaGVvcnlUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYWRkTGFtYmRhKVxyXG4gICAgcGV0VGhlb3J5VGFibGUuZ3JhbnRGdWxsQWNjZXNzKGFkZExhbWJkYSlcclxuICAgIGFkZExhbWJkYS5hZGRFbnZpcm9ubWVudChcIkR5bmFtb1RhYmxlXCIsIHBldFRoZW9yeVRhYmxlLnRhYmxlTmFtZSk7XHJcbiAgICBcclxuXHJcbiAgICAvLyBSVUxFXHJcbiAgICBjb25zdCBydWxlID0gbmV3IFJ1bGUodGhpcywgXCJ0aGUtUnVsZWVlXCIsIHtcclxuICAgICAgcnVsZU5hbWU6IFwiUnVsZXNmb3JwZXRcIixcclxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XHJcbiAgICAgICAgc291cmNlOiBbXCJQZXRFdmVudHNcIl0sXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvL2FkZGluZyB0YXJnZXQgXHJcbiAgICBydWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihhZGRMYW1iZGEpKTtcclxuXHJcbiAgICAvLyBDcmVhdGluZyBhIElBTSByb2xlIGZvciBsYW1iZGEgdG8gZ2l2ZSBhY2Nlc3Mgb2Ygc2VzIHNlbmQgZW1haWxcclxuICAgIGNvbnN0IHJvbGUgPSBuZXcgUm9sZSh0aGlzLCAnTGFtYmRhUm9sZScsIHtcclxuICAgICAgYXNzdW1lZEJ5OiBuZXcgU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcclxuICAgIH0pO1xyXG4gICAgLy8vQXR0YWNoaW5nIHNlcyBhY2Nlc3MgdG8gcG9saWN5XHJcbiAgICBjb25zdCBwb2xpY3kgPSBuZXcgUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXHJcbiAgICAgIGFjdGlvbnM6IFtcInNlczpTZW5kRW1haWxcIiwgXCJzZXM6U2VuZFJhd0VtYWlsXCIsIFwibG9nczoqXCJdLFxyXG4gICAgICByZXNvdXJjZXM6IFsnKiddXHJcbiAgICB9KTtcclxuICAgIC8vZ3JhbnRpbmcgSUFNIHBlcm1pc3Npb25zIHRvIHJvbGVcclxuICAgIHJvbGUuYWRkVG9Qb2xpY3kocG9saWN5KTtcclxuXHJcbiAgICAvLyAgQ3JlYXRpbmcgc2VuZCBlbWFpbCBsYW1iZGEgaGFuZGxlclxyXG4gICAgY29uc3QgZW1haWxTZW5kZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiSGFuZGxlU2VuZEVtYWlsXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzEwX1gsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcImZucy1sYW1iZGFcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwibGFtYmRhLmhhbmRsZXJcIixcclxuICAgICAgcm9sZTogcm9sZVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gY3JlYXRlIHRoZSBBUEkgR2F0ZXdheSB3aXRoIG9uZSBtZXRob2QgYW5kIHBhdGggRm9yIGxhbWJkYVxyXG4gICAgY29uc3QgYXBpID0gbmV3IGFwaWd3LlJlc3RBcGkodGhpcywgXCJTZW5kRW1haWxFbmRQb2ludFwiKVxyXG4gICAgYXBpXHJcbiAgICAgIC5yb290XHJcbiAgICAgIC5yZXNvdXJjZUZvclBhdGgoXCJzZW5kbWFpbFwiKVxyXG4gICAgICAuYWRkTWV0aG9kKFwiUE9TVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oZW1haWxTZW5kZXIpKVxyXG5cclxuXHJcbiAgICAvLyBsb2dnaW5nIGFwaSBlbmRwb2ludFxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NlbmQgZW1haWwgZW5kcG9pbnQnLCB7XHJcbiAgICAgIHZhbHVlOiBgJHthcGkudXJsfXNlbmRtYWlsYFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy9TVEVQU1xyXG4gICAgY29uc3QgZmlyc3RTdGVwID0gbmV3IHN0ZXBGdW5jdGlvblRhc2tzLkxhbWJkYUludm9rZShcclxuICAgICAgdGhpcyxcclxuICAgICAgXCJJbnZva2UgYWRkRGF0YSBsYW1iZGFcIixcclxuICAgICAge1xyXG4gICAgICAgIGxhbWJkYUZ1bmN0aW9uOiBlbWFpbFNlbmRlcixcclxuICAgICAgfVxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCBzZWNvbmRTdGVwID0gbmV3IHN0ZXBGdW5jdGlvblRhc2tzLkxhbWJkYUludm9rZShcclxuICAgICAgdGhpcyxcclxuICAgICAgXCJJbnZva2Ugc2VzIGxhbWJkYVwiLFxyXG4gICAgICB7XHJcbiAgICAgICAgbGFtYmRhRnVuY3Rpb246IGFkZExhbWJkYSxcclxuICAgICAgfVxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCBjaGFpbiA9IHN0ZXBGdW5jdGlvbnMuQ2hhaW4uc3RhcnQoZmlyc3RTdGVwKS5uZXh0KHNlY29uZFN0ZXApXHJcblxyXG4gICAgLy8gY3JlYXRlIGEgc3RhdGUgbWFjaGluZVxyXG5cclxuICAgIGNvbnN0IHN0ZXBGbiA9IG5ldyBzdGVwRnVuY3Rpb25zLlN0YXRlTWFjaGluZShcclxuICAgICAgdGhpcyxcclxuICAgICAgXCJzdGF0ZU1hY2hpbmVFdmVudERyaXZlblwiLFxyXG4gICAgICB7XHJcbiAgICAgICAgZGVmaW5pdGlvbjogY2hhaW4sXHJcbiAgICAgIH1cclxuICAgICk7XHJcblxyXG4gIHJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLlNmblN0YXRlTWFjaGluZShzdGVwRm4pKTtcclxuXHJcbiAgXHJcbiAgICAvLyBjcmVhdGUgYW4gU05TIHRvcGljXHJcbiAgICBjb25zdCBteVRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCBcIk15VG9waWNcIik7XHJcblxyXG4gICAgLy8gY3JlYXRlIGEgZGVhZCBsZXR0ZXIgcXVldWVcclxuICAgIGNvbnN0IGRsUXVldWUgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsIFwiRGVhZExldHRlclF1ZXVlXCIsIHtcclxuICAgICAgcXVldWVOYW1lOiBcIk15U3Vic2NyaXB0aW9uX0RMUVwiLFxyXG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIHN1YnNjcmliZSBTTVMgbnVtYmVyIHRvIHRoZSB0b3BpY1xyXG4gICAgbXlUb3BpYy5hZGRTdWJzY3JpcHRpb24oXHJcbiAgICAgIG5ldyBzdWJzY3JpcHRpb25zLlNtc1N1YnNjcmlwdGlvbihcIis5MjMxNTg1NjQ2MTRcIiwge1xyXG4gICAgICAgIGRlYWRMZXR0ZXJRdWV1ZTogZGxRdWV1ZSxcclxuICAgICAgIFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuICAgIHJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLlNuc1RvcGljKG15VG9waWMpKTtcclxuXHJcbiAgICAgICAgICAvLyBQcmludHMgb3V0IHRoZSBBcHBTeW5jIEdyYXBoUUwgZW5kcG9pbnQgdG8gdGhlIHRlcm1pbmFsXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkdyYXBoUUxBUElVUkxcIiwge1xyXG4gICAgICB2YWx1ZTogYXBpR2F0ZXdheS5ncmFwaHFsVXJsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBQcmludHMgb3V0IHRoZSBBcHBTeW5jIEdyYXBoUUwgQVBJIGtleSB0byB0aGUgdGVybWluYWxcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiR3JhcGhRTEFQSUtleVwiLCB7XHJcbiAgICAgIHZhbHVlOiBhcGlHYXRld2F5LmFwaUtleSB8fCAnJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gUHJpbnRzIG91dCB0aGUgc3RhY2sgcmVnaW9uIHRvIHRoZSB0ZXJtaW5hbFxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJTdGFjayBSZWdpb25cIiwge1xyXG4gICAgICB2YWx1ZTogdGhpcy5yZWdpb25cclxuICAgIH0pO1xyXG5cclxuXHJcbiAgfVxyXG5cclxufSJdfQ==