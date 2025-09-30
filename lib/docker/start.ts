import type {builderDatabase} from "@/types/db";
import Docker from "dockerode";
import Logger from "@iglu-sh/logger";
import DockerWrapper from "@/lib/docker/dockerWrapper.ts";

/*
* This file is responsible for starting the Docker container for a given builder config id
* It **just** starts up the docker and sets things like IP address etc.
* No validation tasks will be performed here, instead those should be done in the calling function (i.e the Redis refresh_queue function)
* @param {string} builderConfigID - The ID of the builder config to start
* @param {string} run_ID - The ID of the run in the database
* @return {Promise<void>}
* @throws {Error} If there is an error in starting the Docker container or if the builder config is not found
* */
export async function start(builderConfigID:number, run_ID:string){


    // Create a unique Docker container name using the builder config ID and run ID
    const CONTAINER_NAME = `iglu-builder_${builderConfigID}_${run_ID}_${Bun.randomUUIDv7()}`;

    // Create the Docker container with the specified configuration
    //FIXME: This might be a good place create a WritableStream to capture the output of the Docker container and then deprecate the whole websocket output thing
    DockerWrapper.startBuilder(CONTAINER_NAME, builderConfigID, run_ID, "latest", "DEBUG")
}