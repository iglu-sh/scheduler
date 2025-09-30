/*
* Contains functions to register events and handle Docker events.
* */
import Docker from "dockerode";
import type {RedisClientType} from "redis";
import Logger from "@iglu-sh/logger";
import {z} from 'zod'
import * as fs from "node:fs";
import {startupHandler, stopHandler} from "@/lib/docker/eventHelpers.ts";
import Redis from "@/lib/redis.ts";
/*
* @description Registers Docker events and handlers for build start, stop, and error.
* @param {Docker} docker - The Docker instance to register events on.
* @param {RedisClientType} redis - The Redis client to publish events to.
* */
export function registerDockerEvents(
    docker:Docker,
    node_id:string
){
    docker.getEvents(async (err, data)=>{
        if(err){
            Logger.error(`Error getting Docker events: ${err.message}`);
            throw new Error(`Error getting Docker events: ${err.message}`);
        }
        if(!data){
            Logger.error(`Got empty Docker event stream`);
            throw new Error(`Got empty Docker event stream`);
        }
        Logger.debug(`Docker event stream started successfully`);
        data.on('start', ()=>{
            Logger.debug(`Docker event stream started`);
        })
        data.on('data', async (message:Buffer)=>{
            const event = JSON.parse(message.toString());

            // Confirm that this is a valid Docker event (which it should be but you never know)
            const eventSchema = z.object({
                'Type': z.enum([
                    "builder",
                    "config",
                    "container",
                    "daemon",
                    "image",
                    "network",
                    "node",
                    "plugin",
                    "secret",
                    "service",
                    "volume"
                ]),
                'Action': z.string(),
                'Actor': z.object({
                    ID: z.string(),
                    Attributes: z.record(z.string(), z.string())
                }),
                'scope': z.enum(['local', 'swarm']),
                'time': z.number(),
                'timeNano': z.number()
            })
            const parsedEvent = eventSchema.safeParse(event);
            if(!parsedEvent.success){
                Logger.error(`Invalid Docker event received: ${message.toString()}`);
                return;
            }

            const parsedEventData = parsedEvent.data;

            // Decide which codepath we want to take based on the event type
            // As of now, we only care about container events, this could change in the future though
            if(parsedEventData.Type !== 'container'){
                Logger.debug(`Ignoring Docker event of type ${parsedEventData.Type}`);
                return;
            }

            // Check if this event is related to a container under our management
            // As a reminder, a container name is created according to the following format:
            // iglu-builder_<build_id>_<node_id>
            // So first we need to check if the container name starts with 'iglu-builder_'
            const DOCKER_NAME = parsedEventData.Actor.Attributes.name || '';
            if(!DOCKER_NAME || !DOCKER_NAME.startsWith('iglu_builder')){
                Logger.debug(`Ignoring Docker event for unrelated container: ${DOCKER_NAME}`);
                return;
            }

            // Now we check if the event is related to a container that we are managing (i.e a container matching our node_id)
            const CONTAINER_NODE_ID = DOCKER_NAME.split('_')[2];
            if(CONTAINER_NODE_ID !== node_id){
                Logger.debug(`Ignoring Docker event for iglu_builder ${DOCKER_NAME} not managed by this node`);
                Logger.error(`Are you running two schedulers on the same node? This is not recommended and should be avoided.`);
                return;
            }

            // Now we can handle the event based on its action
            if(parsedEventData.Action === 'start'){
                // We now run the builderStartup function to initialize the container and build
                startupHandler(docker, DOCKER_NAME, parsedEventData.Actor.ID)
            }
            else if(parsedEventData.Action === 'die' || parsedEventData.Action === 'stop'){
                // Once a container stops, we run the stopHandler function to clean up and after that refresh the queue
                stopHandler(docker, DOCKER_NAME, parsedEventData.Actor.ID)
                Redis.stopHandler(DOCKER_NAME, parsedEventData.Actor.ID)
            }
            else{
                Logger.debug(`Ignoring Docker event with action ${parsedEventData.Action} for container ${DOCKER_NAME}`);
            }
        })
    })
}

export function startContainer(
    build_id: string,
    builderConfigID: number,
    node_id: string,
    docker:Docker
){
    // A Container name is created using the build_id, node_id and builderConfigID to ensure uniqueness
    // A sample ID would therefore look like this:
    // iglu-builder_8f4339e0-a19a-41e7-86d2-50ea1d5c883b_123e4567-e89b-12d3-a456-426614174000
    const CONTAINER_NAME = `iglu-builder_${build_id}_${node_id}`
    docker.run(`ghcr.io/iglu-sh/iglu-builder:latest`, [], [], {Tty: false, name: CONTAINER_NAME, HostConfig:{NetworkMode:'iglu-nw'}, Env: ['LOG_LEVEL=DEBUG']}, async (err:Error)=>{
        if(err){
            Logger.error(`Error starting Docker container for builder config ID ${builderConfigID}: ${err.message}`);
            throw new Error(`Error starting Docker container for builder config ID ${builderConfigID}: ${err.message}`);
        }
    })
}