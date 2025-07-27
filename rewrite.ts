import Logger from "@iglu-sh/logger";
import type {healthCheckResponse} from "@iglu-sh/types/scheduler";
import redis from "redis";
import {startup} from "@/lib/startup.ts";
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
const {env, node_id} = await startup().catch((err:Error)=>{
    Logger.error(`Failed to start scheduler: ${err.message}`);
    process.exit(1)
})

Logger.info('Startup Complete')
Logger.debug('Listening for builds and on the node channel...')

// Setup Redis clients for editor and subscriber
const editor = redis.createClient({
    url: env.REDIS_URL
})
const subscriber = redis.createClient({
    url: env.REDIS_URL
});

// Handle Redis connection errors
editor.on('error', (err:Error)=>{
    Logger.error(`Redis editor error: ${err.message}`);
})
subscriber.on('error', (err:Error)=>{
    Logger.error(`Redis subscriber error: ${err.message}`);
});
subscriber.on('connect', async ()=>{
    Logger.info('Connected to Redis subscriber');

    // Subscribe to the node channel
    await subscriber.subscribe('node', (message:string)=>{
        Logger.debug(`Received ${message} on node channel`);
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
