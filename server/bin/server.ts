#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ServerStack } from '../lib/server-stack';

const app = new cdk.App();
new ServerStack(app, 'ServerStack');
