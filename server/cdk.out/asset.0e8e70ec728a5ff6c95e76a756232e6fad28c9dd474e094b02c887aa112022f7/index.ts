import * as cdk from '@aws-cdk/core';
import * as lambda from "@aws-cdk/aws-lambda";
import * as apigw from "@aws-cdk/aws-apigateway";
import * as events from "@aws-cdk/aws-events";
import * as ddb from '@aws-cdk/aws-dynamodb';
import * as appsync from "@aws-cdk/aws-appsync";
import * as targets from "@aws-cdk/aws-events-targets";
import { requestTemplate, responseTemplate } from "../response-request";
import { Rule } from '@aws-cdk/aws-events';
import { Effect, PolicyStatement, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import * as stepFunctions from "@aws-cdk/aws-stepfunctions";
import * as stepFunctionTasks from "@aws-cdk/aws-stepfunctions-tasks";

export class ServerStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
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
    })

    // HTTP DATASOURCE
    const httpDs = apiGateway.addHttpDataSource(
      "ds",
      "https://events." + this.region + ".amazonaws.com/", // This is the ENDPOINT for eventbridge.
      {
        name: "httpDsWithEventBridge",
        description: "From Appsync to Eventbridge",
        authorizationConfig: {
          signingRegion: this.region,
          signingServiceName: "events",
        },
      }
    );
    events.EventBus.grantPutEvents(httpDs);
    // RESOLVERS
    const mutations = ["addReport"]

    mutations.forEach((mutation) => {
      let details = `\\\"id\\\": \\\"$ctx.args.id\\\"`;

      if (mutation === "addReport") {
        details = `\\\"name\\\":\\\"$ctx.args.report.name\\\" , \\\"email\\\":\\\"$ctx.args.report.email\\\" , \\\"message\\\":\\\"$ctx.args.report.message\\\"`;

      }

      httpDs.createResolver({
        typeName: "Mutation",
        fieldName: mutation,
        requestMappingTemplate: appsync.MappingTemplate.fromString(requestTemplate(details, mutation)),
        responseMappingTemplate: appsync.MappingTemplate.fromString(responseTemplate()),
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
    petTable.grantReadWriteData(petsLambda)
    petTable.grantFullAccess(petsLambda)
    petsLambda.addEnvironment("DynamoTable", petTable.tableName);
    // STEPS
    const firstStep = new stepFunctionTasks.LambdaInvoke(
      this,
      "Invoke addData lambda",
      {
        lambdaFunction: petsLambda,
      }
    );
    // Reaching a Succeed state terminates the state machine execution with a succesful status.

    const success = new stepFunctions.Succeed(this, "Job Successful");
    
     // Reaching a Fail state terminates the state machine execution with a failure status.

     const jobFailed = new stepFunctions.Fail(this, "Job Failed", {
      cause: "Lambda Job Failed",
      error: "could not add data to the dynamoDb",
    });

    // choice state

    const choice = new stepFunctions.Choice(this, "operation successful?");
    choice.when(
      stepFunctions.Condition.booleanEquals(
        "$.Payload.operationSuccessful",
        true
      ),
      success
    );
    choice.when(
      stepFunctions.Condition.booleanEquals(
        "$.Payload.operationSuccessful",
        false
      ),
      jobFailed
    );

    // creating chain to define the sequence of execution

    const chain = stepFunctions.Chain.start(firstStep)
      .next(choice);

    // create a state machine

    const stepFn = new stepFunctions.StateMachine(
      this,
      "stateMachineEventDriven",
      {
        definition: chain,
      }
    );

    // RULE
    const rule = new Rule(this, "the-Ruleee", {
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
    const role = new Role(this, 'LambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    ///Attaching ses access to policy
    const policy = new PolicyStatement({
      effect: Effect.ALLOW,
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
    const api = new apigw.RestApi(this, "SendEmailEndPoint")
    api
      .root
      .resourceForPath("sendmail")
      .addMethod("POST", new apigw.LambdaIntegration(emailSender))


    // logging api endpoint
    new cdk.CfnOutput(this, 'Send email endpoint', {
      value: `${api.url}sendmail`
    });
  }

}