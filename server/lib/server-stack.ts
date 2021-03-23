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
import * as subscriptions from "@aws-cdk/aws-sns-subscriptions";
import * as sns from "@aws-cdk/aws-sns";
import * as sqs from "@aws-cdk/aws-sqs";

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

    const addLambda = new lambda.Function(this, 'AppSyncNotesHandler', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('functions'),
      memorySize: 1024,
      environment: {
        DYNAMO_TABLE_NAME: petTheoryTable.tableName,
      },
    });
    petTheoryTable.grantReadWriteData(addLambda)
    petTheoryTable.grantFullAccess(addLambda)
    addLambda.addEnvironment("DynamoTable", petTheoryTable.tableName);
    

    // RULE
    const rule = new Rule(this, "the-Ruleee", {
      ruleName: "Rulesforpet",
      eventPattern: {
        source: ["PetEvents"],
      },
    });

    //adding target 
    rule.addTarget(new targets.LambdaFunction(addLambda));

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

    //STEPS
    const firstStep = new stepFunctionTasks.LambdaInvoke(
      this,
      "Invoke addData lambda",
      {
        lambdaFunction: emailSender,
      }
    );

    const secondStep = new stepFunctionTasks.LambdaInvoke(
      this,
      "Invoke ses lambda",
      {
        lambdaFunction: addLambda,
      }
    );

    const chain = stepFunctions.Chain.start(firstStep).next(secondStep)

    // create a state machine

    const stepFn = new stepFunctions.StateMachine(
      this,
      "stateMachineEventDriven",
      {
        definition: chain,
      }
    );

  rule.addTarget(new targets.SfnStateMachine(stepFn));

  
    // create an SNS topic
    const myTopic = new sns.Topic(this, "MyTopic");

    // create a dead letter queue
    const dlQueue = new sqs.Queue(this, "DeadLetterQueue", {
      queueName: "MySubscription_DLQ",
      retentionPeriod: cdk.Duration.days(14),
    });

    // subscribe SMS number to the topic
    myTopic.addSubscription(
      new subscriptions.SmsSubscription("+923158564614", {
        deadLetterQueue: dlQueue,
       
      })
    );
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