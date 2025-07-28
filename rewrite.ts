import Logger from "@iglu-sh/logger";
import type {healthCheckResponse} from "@iglu-sh/types/scheduler";
import redis from "redis";
import {z} from 'zod'
import {startup} from "@/lib/startup.ts";
import type {NodeChannelMessage} from "@iglu-sh/types/controller";
const PORT = process.env.PORT || '3000';
const INTERFACE = process.env.INTERFACE || "127.0.0.1"
const STARTED_DATE = new Date();

function isAuthenticated(req:Request):boolean{
    if(!req.headers.get("Authorization")){
        return false;
    }
    const authHeader = req.headers.get("Authorization") || '';
    const authToken = authHeader.split(' ')[1];
    return !(!authToken || authToken !== process.env.AUTH_TOKEN);
}
let {env, node_id, node_data} = await startup().catch((err:Error)=>{
    Logger.error(`Failed to start scheduler: ${err.message}`);
    process.exit(1)
})

Logger.info('Startup Complete')
Logger.debug('Listening for builds and on the node channel...')

// Setup Redis clients for editor and subscriber
const editor = redis.createClient({
    url: `redis://${env.REDIS_USER}:${env.REDIS_PASSWORD}@${env.REDIS_HOST}:${env.REDIS_PORT}/0`,
})
const subscriber = redis.createClient({
    url: `redis://${env.REDIS_USER}:${env.REDIS_PASSWORD}@${env.REDIS_HOST}:${env.REDIS_PORT}/0`,
});

// Handle Redis connection errors
editor.on('error', (err:Error)=>{
    Logger.error(`Redis editor error: ${err.message}`);
})
subscriber.on('error', (err:Error)=>{
    Logger.error(`Redis subscriber error: ${err.message}`);
});

// Handle Process exit to close Redis connections gracefully
process.on('SIGINT', async ()=>{
    Logger.info('SIGINT received, closing Redis connections...');
    await editor.quit();
    await subscriber.quit();
    Logger.info('Redis connections closed, exiting process.');
    process.exit(0);
});

// Subscribe to both channels
subscriber.on('connect', async ()=>{
    Logger.info('Connected to Redis subscriber');
    // Subscribe to the node channel
    await subscriber.subscribe('node', async (message:string)=>{
        Logger.debug(`Received ${message} on node channel, current NodeID: ${node_id}`);

        // Parse the message as a health check response
        const messageData:NodeChannelMessage = JSON.parse(message) as NodeChannelMessage;
        const schema = z.custom<NodeChannelMessage>();
        const result = schema.safeParse(messageData);
        if(!result.success){
            Logger.error(`Invalid message received on node channel: ${result.error.message}`);
            return;
        }

        // Check if the message is targeted at this node
        if(messageData.target !== node_id){
            Logger.debug(`Message not targeted at scheduler, ignoring`);
            return;
        }

        // Check if the message is a health check request
        if(messageData.type !== 'health_check' && messageData.type !== 'deregister'){
            Logger.debug(`Message type is not health_check, ignoring`);
            return;
        }
        Logger.info('Received health check request from controller');
        // Handle health check response
        if(messageData.type === 'health_check'){
            const healthCheckData:healthCheckResponse = {
                status: 'OK',
                uptime: -1,
                version: 'Unknown',
                arch: node_data.node_arch,
                os: node_data.node_os
            }

            // Calculate uptime
            healthCheckData.uptime = Math.floor((Date.now() - STARTED_DATE.getTime()) / 1000);

            const returnMessage:NodeChannelMessage = {
                type: 'health_check',
                target: 'controller',
                sender: node_id,
                data: healthCheckData
            }
            console.log(`Health check response: ${JSON.stringify(healthCheckData)}`);
            const returnString = JSON.stringify(returnMessage);
            // Send the health check response back to the controller
            editor.publish('node', returnString);
        }

        if(messageData.type === 'deregister'){
            Logger.info(`Node ${node_id} received deregister request from controller`);
            // Handle deregistration
            const deregisterMessage:NodeChannelMessage = {
                type: 'deregister',
                target: 'controller',
                sender: node_id,
                data: {message: 'deregistered'}
            }
            // Publish the deregister message to the controller
            editor.publish('node', JSON.stringify(deregisterMessage));

            // Remove the node from Redis
            await editor.json.del(`node:${node_id}`).catch((err:Error)=>{
                Logger.error(`Failed to delete node from redis: ${err.message}`);
            });
            Logger.info(`Node ${node_id} deregistered successfully`);
            // Wait 5 seconds, then call startup again and hope we can re-join
            setTimeout(async ()=>{
                Logger.info(`Restarting scheduler after deregistration`);
                await startup().then((newEnv)=>{
                    // Set the new environment variables
                    env = newEnv.env;
                    node_id = newEnv.node_id;
                    node_data = newEnv.node_data;
                }).catch((err:Error)=>{
                    Logger.error(`Failed to restart scheduler: ${err.message}`);
                    process.exit(1);
                });
            }, 5000);
        }
    })


    // Subscribe to the build channel
    await subscriber.subscribe('build', (message:string)=>{
        Logger.debug(`Received ${message} on build channel`);
    })
})

// Connect the clients, log errors, and exit if connection fails
await editor.connect().catch((err:Error)=>{
    Logger.error(`Failed to connect Redis editor: ${err.message}`);
    process.exit(1);
});
await subscriber.connect().catch((err:Error)=>{
    Logger.error(`Failed to connect Redis subscriber: ${err.message}`);
    process.exit(1);
});

// Insert the node information into Redis
await editor.json.set(`node:${node_id}`, "$", node_data);