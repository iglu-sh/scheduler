import Docker from "dockerode";
import type {RedisClientType} from "redis";
import Redis from "@/lib/redis.ts";
import Logger from "@iglu-sh/logger";

/*
* @description Handles the Startup of a Docker Container (e.g. build a nixconfig)
* @param {Docker} docker - The Docker instance to use for starting the container.
* @param {RedisClientType} redis - The Redis client to use for publishing events.
* @param {string} container_name - The name of the Docker container to inspect.
* @param {string} actor_id - The ID of the actor that started the container.
* */
export async function startupHandler(docker:Docker, container_name:string, actor_id:string){
    // First, we need to inspect the container to get its details
    const container = docker.getContainer(container_name)
    const container_inspect_data = await container.inspect()
    if(!container_inspect_data){
        throw new Error(`Failed to inspect container ${container_name}`);
    }

    const container_ip_config = container_inspect_data.NetworkSettings.Networks["iglu-nw"];
    if(!container_ip_config){
        Logger.error(`Started builder container not connected to iglu-nw ${container_name}`)
        throw new Error(`Failed to inspect container ${container_name}`);
    }
    const ipAddress = container_ip_config.IPAddress;
    Logger.debug(`Container ${container_name} started, IP Address: ${ipAddress}`);

    // TODO: Implement Startup Logic
    /*
    * Startup Logic for a run, this includes sending a buildUpdate on the Redis Build Channel as well as
    * */
}
export async function stopHandler(container_name:string, stop_type:"die"|"stop"){
    await Redis.dockerStopHandler(container_name, stop_type === 'die' ? "failed" : "success")
}
