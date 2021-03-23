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
        const petTable = new ddb.Table(this, 'CDKPetTable', {
            partitionKey: {
                name: 'id',
                type: ddb.AttributeType.STRING,
            },
        });
        // DYANAMO AS DS
        const ddbAsDS = apiGateway.addDynamoDbDataSource("thePetTable", petTable);
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
        const petsLambda = new lambda.Function(this, 'AppSyncNotesHandler', {
            runtime: lambda.Runtime.NODEJS_12_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('functions'),
            memorySize: 1024,
            environment: {
                DYNAMO_TABLE_NAME: petTable.tableName,
            },
        });
        petTable.grantReadWriteData(petsLambda);
        petTable.grantFullAccess(petsLambda);
        petsLambda.addEnvironment("DynamoTable", petTable.tableName);
        // STEPS
        const firstStep = new stepFunctionTasks.LambdaInvoke(this, "Invoke addData lambda", {
            lambdaFunction: petsLambda,
        });
        // Reaching a Succeed state terminates the state machine execution with a succesful status.
        const success = new stepFunctions.Succeed(this, "Job Successful");
        // Reaching a Fail state terminates the state machine execution with a failure status.
        const jobFailed = new stepFunctions.Fail(this, "Job Failed", {
            cause: "Lambda Job Failed",
            error: "could not add data to the dynamoDb",
        });
        // choice state
        const choice = new stepFunctions.Choice(this, "operation successful?");
        choice.when(stepFunctions.Condition.booleanEquals("$.Payload.operationSuccessful", true), success);
        choice.when(stepFunctions.Condition.booleanEquals("$.Payload.operationSuccessful", false), jobFailed);
        // creating chain to define the sequence of execution
        const chain = stepFunctions.Chain.start(firstStep)
            .next(choice);
        // create a state machine
        const stepFn = new stepFunctions.StateMachine(this, "stateMachineEventDriven", {
            definition: chain,
        });
        // RULE
        const rule = new aws_events_1.Rule(this, "the-Ruleee", {
            ruleName: "Rulesforpet",
            eventPattern: {
                source: ["PetEvents"],
            },
        });
        //adding target 
        rule.addTarget(new targets.LambdaFunction(petsLambda));
        rule.addTarget(new targets.SfnStateMachine(stepFn));
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
    }
}
exports.ServerStack = ServerStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxQ0FBcUM7QUFDckMsOENBQThDO0FBQzlDLGlEQUFpRDtBQUNqRCw4Q0FBOEM7QUFDOUMsNkNBQTZDO0FBQzdDLGdEQUFnRDtBQUNoRCx1REFBdUQ7QUFDdkQsMERBQXdFO0FBQ3hFLG9EQUEyQztBQUMzQyw4Q0FBbUY7QUFDbkYsNERBQTREO0FBQzVELHNFQUFzRTtBQUV0RSxNQUFhLFdBQVksU0FBUSxHQUFHLENBQUMsS0FBSztJQUN4QyxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQ2xFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLDZDQUE2QztRQUM3QyxNQUFNO1FBQ04sTUFBTSxVQUFVLEdBQUcsSUFBSSxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7WUFDckQsSUFBSSxFQUFFLHVCQUF1QjtZQUM3QixNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUM7WUFDdEQsbUJBQW1CLEVBQUU7Z0JBQ25CLG9CQUFvQixFQUFFO29CQUNwQixpQkFBaUIsRUFBRSxPQUFPLENBQUMsaUJBQWlCLENBQUMsT0FBTztpQkFFckQ7YUFDRjtTQUVGLENBQUMsQ0FBQztRQUNILE1BQU0sUUFBUSxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ2xELFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsSUFBSTtnQkFDVixJQUFJLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQy9CO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsZ0JBQWdCO1FBQ2hCLE1BQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxxQkFBcUIsQ0FBQyxhQUFhLEVBQUUsUUFBUSxDQUFDLENBQUM7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QzNCLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQTtRQUc5RCx1QkFBdUI7UUFDdkIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUM3QyxLQUFLLEVBQUUsR0FBRyxHQUFHLENBQUMsR0FBRyxVQUFVO1NBQzVCLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FFRjtBQXJNRCxrQ0FxTUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XHJcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tIFwiQGF3cy1jZGsvYXdzLWxhbWJkYVwiO1xyXG5pbXBvcnQgKiBhcyBhcGlndyBmcm9tIFwiQGF3cy1jZGsvYXdzLWFwaWdhdGV3YXlcIjtcclxuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gXCJAYXdzLWNkay9hd3MtZXZlbnRzXCI7XHJcbmltcG9ydCAqIGFzIGRkYiBmcm9tICdAYXdzLWNkay9hd3MtZHluYW1vZGInO1xyXG5pbXBvcnQgKiBhcyBhcHBzeW5jIGZyb20gXCJAYXdzLWNkay9hd3MtYXBwc3luY1wiO1xyXG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gXCJAYXdzLWNkay9hd3MtZXZlbnRzLXRhcmdldHNcIjtcclxuaW1wb3J0IHsgcmVxdWVzdFRlbXBsYXRlLCByZXNwb25zZVRlbXBsYXRlIH0gZnJvbSBcIi4uL3Jlc3BvbnNlLXJlcXVlc3RcIjtcclxuaW1wb3J0IHsgUnVsZSB9IGZyb20gJ0Bhd3MtY2RrL2F3cy1ldmVudHMnO1xyXG5pbXBvcnQgeyBFZmZlY3QsIFBvbGljeVN0YXRlbWVudCwgUm9sZSwgU2VydmljZVByaW5jaXBhbCB9IGZyb20gJ0Bhd3MtY2RrL2F3cy1pYW0nO1xyXG5pbXBvcnQgKiBhcyBzdGVwRnVuY3Rpb25zIGZyb20gXCJAYXdzLWNkay9hd3Mtc3RlcGZ1bmN0aW9uc1wiO1xyXG5pbXBvcnQgKiBhcyBzdGVwRnVuY3Rpb25UYXNrcyBmcm9tIFwiQGF3cy1jZGsvYXdzLXN0ZXBmdW5jdGlvbnMtdGFza3NcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBTZXJ2ZXJTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IGNkay5Db25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIC8vIFRoZSBjb2RlIHRoYXQgZGVmaW5lcyB5b3VyIHN0YWNrIGdvZXMgaGVyZVxyXG4gICAgLy8gQVBJXHJcbiAgICBjb25zdCBhcGlHYXRld2F5ID0gbmV3IGFwcHN5bmMuR3JhcGhxbEFwaSh0aGlzLCBcIkFwaVwiLCB7XHJcbiAgICAgIG5hbWU6IFwiYXBwc3luY0V2ZW50YnJpZGdlQVBJXCIsXHJcbiAgICAgIHNjaGVtYTogYXBwc3luYy5TY2hlbWEuZnJvbUFzc2V0KFwiZ3JhcGhxbC9zY2hlbWEuZ3FsXCIpLFxyXG4gICAgICBhdXRob3JpemF0aW9uQ29uZmlnOiB7XHJcbiAgICAgICAgZGVmYXVsdEF1dGhvcml6YXRpb246IHtcclxuICAgICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcHBzeW5jLkF1dGhvcml6YXRpb25UeXBlLkFQSV9LRVksXHJcbiAgICAgICAgIFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgXHJcbiAgICB9KTtcclxuICAgIGNvbnN0IHBldFRhYmxlID0gbmV3IGRkYi5UYWJsZSh0aGlzLCAnQ0RLUGV0VGFibGUnLCB7XHJcbiAgICAgIHBhcnRpdGlvbktleToge1xyXG4gICAgICAgIG5hbWU6ICdpZCcsXHJcbiAgICAgICAgdHlwZTogZGRiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gRFlBTkFNTyBBUyBEU1xyXG4gICAgY29uc3QgZGRiQXNEUyA9IGFwaUdhdGV3YXkuYWRkRHluYW1vRGJEYXRhU291cmNlKFwidGhlUGV0VGFibGVcIiwgcGV0VGFibGUpO1xyXG5cclxuICAgIGRkYkFzRFMuY3JlYXRlUmVzb2x2ZXIoe1xyXG4gICAgICB0eXBlTmFtZTogXCJRdWVyeVwiLFxyXG4gICAgICBmaWVsZE5hbWU6IFwiZ2V0UmVwb3J0c1wiLFxyXG4gICAgICByZXF1ZXN0TWFwcGluZ1RlbXBsYXRlOiBhcHBzeW5jLk1hcHBpbmdUZW1wbGF0ZS5keW5hbW9EYlNjYW5UYWJsZSgpLFxyXG4gICAgICByZXNwb25zZU1hcHBpbmdUZW1wbGF0ZTogYXBwc3luYy5NYXBwaW5nVGVtcGxhdGUuZHluYW1vRGJSZXN1bHRMaXN0KCksXHJcbiAgICB9KVxyXG5cclxuICAgIC8vIEhUVFAgREFUQVNPVVJDRVxyXG4gICAgY29uc3QgaHR0cERzID0gYXBpR2F0ZXdheS5hZGRIdHRwRGF0YVNvdXJjZShcclxuICAgICAgXCJkc1wiLFxyXG4gICAgICBcImh0dHBzOi8vZXZlbnRzLlwiICsgdGhpcy5yZWdpb24gKyBcIi5hbWF6b25hd3MuY29tL1wiLCAvLyBUaGlzIGlzIHRoZSBFTkRQT0lOVCBmb3IgZXZlbnRicmlkZ2UuXHJcbiAgICAgIHtcclxuICAgICAgICBuYW1lOiBcImh0dHBEc1dpdGhFdmVudEJyaWRnZVwiLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIkZyb20gQXBwc3luYyB0byBFdmVudGJyaWRnZVwiLFxyXG4gICAgICAgIGF1dGhvcml6YXRpb25Db25maWc6IHtcclxuICAgICAgICAgIHNpZ25pbmdSZWdpb246IHRoaXMucmVnaW9uLFxyXG4gICAgICAgICAgc2lnbmluZ1NlcnZpY2VOYW1lOiBcImV2ZW50c1wiLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH1cclxuICAgICk7XHJcbiAgICBldmVudHMuRXZlbnRCdXMuZ3JhbnRQdXRFdmVudHMoaHR0cERzKTtcclxuICAgIC8vIFJFU09MVkVSU1xyXG4gICAgY29uc3QgbXV0YXRpb25zID0gW1wiYWRkUmVwb3J0XCJdXHJcblxyXG4gICAgbXV0YXRpb25zLmZvckVhY2goKG11dGF0aW9uKSA9PiB7XHJcbiAgICAgIGxldCBkZXRhaWxzID0gYFxcXFxcXFwiaWRcXFxcXFxcIjogXFxcXFxcXCIkY3R4LmFyZ3MuaWRcXFxcXFxcImA7XHJcblxyXG4gICAgICBpZiAobXV0YXRpb24gPT09IFwiYWRkUmVwb3J0XCIpIHtcclxuICAgICAgICBkZXRhaWxzID0gYFxcXFxcXFwibmFtZVxcXFxcXFwiOlxcXFxcXFwiJGN0eC5hcmdzLnJlcG9ydC5uYW1lXFxcXFxcXCIgLCBcXFxcXFxcImVtYWlsXFxcXFxcXCI6XFxcXFxcXCIkY3R4LmFyZ3MucmVwb3J0LmVtYWlsXFxcXFxcXCIgLCBcXFxcXFxcIm1lc3NhZ2VcXFxcXFxcIjpcXFxcXFxcIiRjdHguYXJncy5yZXBvcnQubWVzc2FnZVxcXFxcXFwiYDtcclxuXHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGh0dHBEcy5jcmVhdGVSZXNvbHZlcih7XHJcbiAgICAgICAgdHlwZU5hbWU6IFwiTXV0YXRpb25cIixcclxuICAgICAgICBmaWVsZE5hbWU6IG11dGF0aW9uLFxyXG4gICAgICAgIHJlcXVlc3RNYXBwaW5nVGVtcGxhdGU6IGFwcHN5bmMuTWFwcGluZ1RlbXBsYXRlLmZyb21TdHJpbmcocmVxdWVzdFRlbXBsYXRlKGRldGFpbHMsIG11dGF0aW9uKSksXHJcbiAgICAgICAgcmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6IGFwcHN5bmMuTWFwcGluZ1RlbXBsYXRlLmZyb21TdHJpbmcocmVzcG9uc2VUZW1wbGF0ZSgpKSxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBwZXRzTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXBwU3luY05vdGVzSGFuZGxlcicsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzEyX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdmdW5jdGlvbnMnKSxcclxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBEWU5BTU9fVEFCTEVfTkFNRTogcGV0VGFibGUudGFibGVOYW1lLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgICBwZXRUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEocGV0c0xhbWJkYSlcclxuICAgIHBldFRhYmxlLmdyYW50RnVsbEFjY2VzcyhwZXRzTGFtYmRhKVxyXG4gICAgcGV0c0xhbWJkYS5hZGRFbnZpcm9ubWVudChcIkR5bmFtb1RhYmxlXCIsIHBldFRhYmxlLnRhYmxlTmFtZSk7XHJcbiAgICAvLyBTVEVQU1xyXG4gICAgY29uc3QgZmlyc3RTdGVwID0gbmV3IHN0ZXBGdW5jdGlvblRhc2tzLkxhbWJkYUludm9rZShcclxuICAgICAgdGhpcyxcclxuICAgICAgXCJJbnZva2UgYWRkRGF0YSBsYW1iZGFcIixcclxuICAgICAge1xyXG4gICAgICAgIGxhbWJkYUZ1bmN0aW9uOiBwZXRzTGFtYmRhLFxyXG4gICAgICB9XHJcbiAgICApO1xyXG4gICAgLy8gUmVhY2hpbmcgYSBTdWNjZWVkIHN0YXRlIHRlcm1pbmF0ZXMgdGhlIHN0YXRlIG1hY2hpbmUgZXhlY3V0aW9uIHdpdGggYSBzdWNjZXNmdWwgc3RhdHVzLlxyXG5cclxuICAgIGNvbnN0IHN1Y2Nlc3MgPSBuZXcgc3RlcEZ1bmN0aW9ucy5TdWNjZWVkKHRoaXMsIFwiSm9iIFN1Y2Nlc3NmdWxcIik7XHJcbiAgICBcclxuICAgICAvLyBSZWFjaGluZyBhIEZhaWwgc3RhdGUgdGVybWluYXRlcyB0aGUgc3RhdGUgbWFjaGluZSBleGVjdXRpb24gd2l0aCBhIGZhaWx1cmUgc3RhdHVzLlxyXG5cclxuICAgICBjb25zdCBqb2JGYWlsZWQgPSBuZXcgc3RlcEZ1bmN0aW9ucy5GYWlsKHRoaXMsIFwiSm9iIEZhaWxlZFwiLCB7XHJcbiAgICAgIGNhdXNlOiBcIkxhbWJkYSBKb2IgRmFpbGVkXCIsXHJcbiAgICAgIGVycm9yOiBcImNvdWxkIG5vdCBhZGQgZGF0YSB0byB0aGUgZHluYW1vRGJcIixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIGNob2ljZSBzdGF0ZVxyXG5cclxuICAgIGNvbnN0IGNob2ljZSA9IG5ldyBzdGVwRnVuY3Rpb25zLkNob2ljZSh0aGlzLCBcIm9wZXJhdGlvbiBzdWNjZXNzZnVsP1wiKTtcclxuICAgIGNob2ljZS53aGVuKFxyXG4gICAgICBzdGVwRnVuY3Rpb25zLkNvbmRpdGlvbi5ib29sZWFuRXF1YWxzKFxyXG4gICAgICAgIFwiJC5QYXlsb2FkLm9wZXJhdGlvblN1Y2Nlc3NmdWxcIixcclxuICAgICAgICB0cnVlXHJcbiAgICAgICksXHJcbiAgICAgIHN1Y2Nlc3NcclxuICAgICk7XHJcbiAgICBjaG9pY2Uud2hlbihcclxuICAgICAgc3RlcEZ1bmN0aW9ucy5Db25kaXRpb24uYm9vbGVhbkVxdWFscyhcclxuICAgICAgICBcIiQuUGF5bG9hZC5vcGVyYXRpb25TdWNjZXNzZnVsXCIsXHJcbiAgICAgICAgZmFsc2VcclxuICAgICAgKSxcclxuICAgICAgam9iRmFpbGVkXHJcbiAgICApO1xyXG5cclxuICAgIC8vIGNyZWF0aW5nIGNoYWluIHRvIGRlZmluZSB0aGUgc2VxdWVuY2Ugb2YgZXhlY3V0aW9uXHJcblxyXG4gICAgY29uc3QgY2hhaW4gPSBzdGVwRnVuY3Rpb25zLkNoYWluLnN0YXJ0KGZpcnN0U3RlcClcclxuICAgICAgLm5leHQoY2hvaWNlKTtcclxuXHJcbiAgICAvLyBjcmVhdGUgYSBzdGF0ZSBtYWNoaW5lXHJcblxyXG4gICAgY29uc3Qgc3RlcEZuID0gbmV3IHN0ZXBGdW5jdGlvbnMuU3RhdGVNYWNoaW5lKFxyXG4gICAgICB0aGlzLFxyXG4gICAgICBcInN0YXRlTWFjaGluZUV2ZW50RHJpdmVuXCIsXHJcbiAgICAgIHtcclxuICAgICAgICBkZWZpbml0aW9uOiBjaGFpbixcclxuICAgICAgfVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyBSVUxFXHJcbiAgICBjb25zdCBydWxlID0gbmV3IFJ1bGUodGhpcywgXCJ0aGUtUnVsZWVlXCIsIHtcclxuICAgICAgcnVsZU5hbWU6IFwiUnVsZXNmb3JwZXRcIixcclxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XHJcbiAgICAgICAgc291cmNlOiBbXCJQZXRFdmVudHNcIl0sXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvL2FkZGluZyB0YXJnZXQgXHJcbiAgICBydWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihwZXRzTGFtYmRhKSk7XHJcbiAgICBydWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5TZm5TdGF0ZU1hY2hpbmUoc3RlcEZuKSk7XHJcblxyXG5cclxuXHJcblxyXG5cclxuICAgIC8vIFByaW50cyBvdXQgdGhlIEFwcFN5bmMgR3JhcGhRTCBlbmRwb2ludCB0byB0aGUgdGVybWluYWxcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiR3JhcGhRTEFQSVVSTFwiLCB7XHJcbiAgICAgIHZhbHVlOiBhcGlHYXRld2F5LmdyYXBocWxVcmxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFByaW50cyBvdXQgdGhlIEFwcFN5bmMgR3JhcGhRTCBBUEkga2V5IHRvIHRoZSB0ZXJtaW5hbFxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJHcmFwaFFMQVBJS2V5XCIsIHtcclxuICAgICAgdmFsdWU6IGFwaUdhdGV3YXkuYXBpS2V5IHx8ICcnXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBQcmludHMgb3V0IHRoZSBzdGFjayByZWdpb24gdG8gdGhlIHRlcm1pbmFsXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlN0YWNrIFJlZ2lvblwiLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLnJlZ2lvblxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ3JlYXRpbmcgYSBJQU0gcm9sZSBmb3IgbGFtYmRhIHRvIGdpdmUgYWNjZXNzIG9mIHNlcyBzZW5kIGVtYWlsXHJcbiAgICBjb25zdCByb2xlID0gbmV3IFJvbGUodGhpcywgJ0xhbWJkYVJvbGUnLCB7XHJcbiAgICAgIGFzc3VtZWRCeTogbmV3IFNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXHJcbiAgICB9KTtcclxuICAgIC8vL0F0dGFjaGluZyBzZXMgYWNjZXNzIHRvIHBvbGljeVxyXG4gICAgY29uc3QgcG9saWN5ID0gbmV3IFBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGVmZmVjdDogRWZmZWN0LkFMTE9XLFxyXG4gICAgICBhY3Rpb25zOiBbXCJzZXM6U2VuZEVtYWlsXCIsIFwic2VzOlNlbmRSYXdFbWFpbFwiLCBcImxvZ3M6KlwiXSxcclxuICAgICAgcmVzb3VyY2VzOiBbJyonXVxyXG4gICAgfSk7XHJcbiAgICAvL2dyYW50aW5nIElBTSBwZXJtaXNzaW9ucyB0byByb2xlXHJcbiAgICByb2xlLmFkZFRvUG9saWN5KHBvbGljeSk7XHJcblxyXG4gICAgLy8gIENyZWF0aW5nIHNlbmQgZW1haWwgbGFtYmRhIGhhbmRsZXJcclxuICAgIGNvbnN0IGVtYWlsU2VuZGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIkhhbmRsZVNlbmRFbWFpbFwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xMF9YLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCJmbnMtbGFtYmRhXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImxhbWJkYS5oYW5kbGVyXCIsXHJcbiAgICAgIHJvbGU6IHJvbGVcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIGNyZWF0ZSB0aGUgQVBJIEdhdGV3YXkgd2l0aCBvbmUgbWV0aG9kIGFuZCBwYXRoIEZvciBsYW1iZGFcclxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlndy5SZXN0QXBpKHRoaXMsIFwiU2VuZEVtYWlsRW5kUG9pbnRcIilcclxuICAgIGFwaVxyXG4gICAgICAucm9vdFxyXG4gICAgICAucmVzb3VyY2VGb3JQYXRoKFwic2VuZG1haWxcIilcclxuICAgICAgLmFkZE1ldGhvZChcIlBPU1RcIiwgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGVtYWlsU2VuZGVyKSlcclxuXHJcblxyXG4gICAgLy8gbG9nZ2luZyBhcGkgZW5kcG9pbnRcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZW5kIGVtYWlsIGVuZHBvaW50Jywge1xyXG4gICAgICB2YWx1ZTogYCR7YXBpLnVybH1zZW5kbWFpbGBcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbn0iXX0=