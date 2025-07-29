import Docker from "dockerode";
import type {RedisClientType} from "redis";

/*
* @description Handles the Startup of a Docker Container (e.g. build a nixconfig)
* @param {Docker} docker - The Docker instance to use for starting the container.
* @param {RedisClientType} redis - The Redis client to use for publishing events.
* @param {string} container_name - The name of the Docker container to inspect.
* @param {string} actor_id - The ID of the actor that started the container.
* */
export async function startupHandler(docker:Docker, redis:RedisClientType, container_name:string, actor_id:string){
    // First, we need to inspect the container to get its details
    const container = docker.getContainer(container_name)
    const container_inspect_data = await container.inspect()
    if(!container_inspect_data){
        throw new Error(`Failed to inspect container ${container_name}`);
    }
    // Now we can publish the event to Redis
    const container_ip = container_inspect_data.NetworkSettings.IPAddress;
    console.log(container_ip)
}
export function stopHandler(docker:Docker, redis:RedisClientType, container_name:string, actor_id:string){

}
