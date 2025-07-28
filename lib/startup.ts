import Logger from "@iglu-sh/logger";
import {z} from 'zod'
import type {nodeRegistrationRequest, nodeRegistrationResponse} from "@iglu-sh/types/scheduler";

/*
* This file is responsible for starting the scheduler.
* */
export async function startup(){
    // Set initial log level until environment variables are validated
    Logger.setLogLevel('DEBUG')
    Logger.info('Starting scheduler...');

    // Validate environment variables
    Logger.debug("Checking environment variables...");
    const envSchema = z.object({
        PORT: z.string().optional().default('3000'),
        INTERFACE: z.string().optional().default('localhost'),
        AUTH_TOKEN: z.string().optional().default(Bun.randomUUIDv7()),
        NODE_NAME: z.string().optional().default('scheduler'),
        MAX_BUILDS: z.string().optional().default('5'),
        CONTROLLER_REGISTRATION_KEY: z.string(),
        LOG_LEVEL: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).optional().default('DEBUG'),
        LOGGER_FORMAT: z.enum(["pretty", "json"]).optional().default('pretty'),
        CONTROLLER_URL: z.string(), //The base url of the controller (e.g 'http://localhost:3000'). URLs will be constructed from this
        REDIS_HOST: z.string(),
        REDIS_USER: z.string().optional().default('default'),
        REDIS_PASSWORD: z.string(),
        REDIS_PORT: z.string().optional().default('6379'),
    });
    const env = envSchema.safeParse(process.env);
    if (!env.success) {
        Logger.error(`Invalid environment variables: ${env.error.message}`);
        throw new Error("Invalid environment variables");
    }
    Logger.setJsonLogging(env.data.LOGGER_FORMAT === 'json')
    Logger.debug("Environment variables are valid");

    Logger.setPrefix(process.env.NODE_NAME!, 'MAGENTA')
    Logger.setLogLevel(process.env.LOG_LEVEL as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR');

    // Contact the controller to register this node
    Logger.debug("Registering node with controller...");

    const registrationBody:nodeRegistrationRequest = {
        node_name: env.data.NODE_NAME,
        node_psk: env.data.AUTH_TOKEN,
        node_address: env.data.INTERFACE,
        node_port: parseInt(env.data.PORT),
        node_version: 'unknown', // This should be set to the version of the scheduler
        node_arch: process.arch,
        node_os: process.platform,
        node_max_jobs: parseInt(env.data.MAX_BUILDS)
    }
    const controllerResponse:nodeRegistrationResponse = await fetch(`${env.data.CONTROLLER_URL}/api/v1/node/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `${env.data.CONTROLLER_REGISTRATION_KEY}`
        },
        body: JSON.stringify(registrationBody)
    }).then((res)=>{
        if (!res.ok) {
            Logger.error(`Failed to register node with controller: ${res.status} ${res.statusText}`);
            throw new Error(`Failed to register node with controller: ${res.status} ${res.statusText}`);
        }
        return res.json() as Promise<nodeRegistrationResponse>;
    })
    .catch((err)=>{
        Logger.error(`Failed to register node with controller: ${err}`);
        throw err;
    });
    Logger.info(`Node registered with controller. ID of this node: ${controllerResponse.node_id}`);
    Logger.debug(`Node registration response: ${JSON.stringify(controllerResponse)}`);

    // All done, return the environment variables and the node_id
    return {
        env: env.data,
        node_id: controllerResponse.node_id,
        node_psk: registrationBody.node_psk
    }
}