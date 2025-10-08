import type {RedisClientType} from "redis";
import Logger from "@iglu-sh/logger";
import type {queueEntry} from "@iglu-sh/types/scheduler";
import {start} from "lib/docker/start"
import type {combinedBuilder} from "@iglu-sh/types/core/db";

export default class Redis {
    private static client: RedisClientType
    public static node_id: string
    private static runningBuilders: Array<{
        job_id: string,
        builder_id: string,
        container_id: string
    }> = []
    constructor(client: RedisClientType, node_id: string) {
        Redis.client = client
        Redis.node_id = node_id
    }
    public static setNodeID(node_id: string): void {
        Redis.node_id = node_id
    }
    public static getClient(): RedisClientType {
        return Redis.client
    }
    public static getRunningBuilders(): Array<{
        job_id: string,
        builder_id: string,
        container_id: string
    }> {
        return Redis.runningBuilders
    }

    public static async getBuildConfig(build_config_id:number):Promise<combinedBuilder>{
        // Fetch the builder config from Redis
        const build_config = await Redis.client.json.get(`builder_config:${build_config_id}`)
        if(!build_config){
            throw new Error(`Builder config with ID ${build_config_id} not found in Redis.`)
        }
        return build_config as combinedBuilder
    }

    public static addBuilderToRunning(job_id:string, builder_id:string, container_id:string): void{
        Redis.runningBuilders.push({
            job_id,
            builder_id,
            container_id
        })
        Redis.checkForNewJobs()
    }
    // Removes the job with the specified job_id from the running builders list and checks for new jobs
    public static async removeJobFromRunning(job_id:string):Promise<void>{
        Redis.runningBuilders = Redis.runningBuilders.filter(builder => builder.job_id !== job_id);
        Redis.checkForNewJobs()
    }
    public static async removeBuilderFromQueue(job_id:string):Promise<void>{
        Logger.debug(`Removing build ${job_id} from queue`)
        // Remove the builder with the specified job_id from the queued builds list in Redis and add it to the running builders list
        await Redis.client.json.get(`node:${Redis.node_id}:queued_builds`).then(async (queued_builds:any) => {
            if(!queued_builds){
                return
            }
            const new_queue = queued_builds.filter((build:any) => build.job_id !== job_id)
            await Redis.client.json.set(`node:${Redis.node_id}:queued_builds`, '.', new_queue)
        })
    }
    public static async checkForNewJobs():Promise<void>{
        Logger.debug("Checking for new jobs...")
        // Check the node:<node_id>:queued_builds list for new jobs and see if we can start any of them
        // We can only start a new job if we are below the MAX_BUILDS limit
        const max_builds = parseInt(process.env.MAX_BUILDS!)
        if(Redis.runningBuilders.length >= max_builds){
            return
        }

        // Get the queued builds from Redis
        const queued_builders:queueEntry[] = await Redis.client.json.get(`node:${Redis.node_id}:queued_builds`).catch((err) => {
            Logger.error("Failed to fetch queued builders. Is your Redis instance reachable?")
            Logger.debug(`Redis Error: ${err}`)
            return []
        }).then((data: unknown) => {
            if (!data || typeof data !== "object" || !Array.isArray(data)) {
                Logger.warn("No queued builders found or data is in an invalid format.")
                Logger.debug(`Redis response: ${data}`)
                return []
            }
            return data as queueEntry[]
        })

        // If the length is zero then we can just exit
        if(queued_builders.length === 0 || !queued_builders[0]){
            Logger.debug(`No builds in queue.`)
            return
        }

        // If the length is more than zero we call the start function.
        const job_id = queued_builders[0].job_id
        const builder_config_id = queued_builders[0].build_config_id
        await Redis.removeBuilderFromQueue(job_id)
        start(parseInt(builder_config_id), job_id, Redis.node_id).catch((err:Error)=>{
            Logger.error(`Failed to start builder for job ID ${job_id} with builder config ID ${builder_config_id}.`)
            Logger.debug(`Error: ${err.message}`)
            this.dockerStopHandler(job_id, "failed")
        })
    }
    public static async dockerStartHandler(job_id:string, builder_id:string, container_id:string){
        Logger.debug("Running docker start redis hook")
        // Add the job to the running builders list in Redis
        Redis.addBuilderToRunning(job_id, builder_id, container_id)
    }
    /*
     * Handles the exit of a specific container. It removes the Job from the running builders array in redis,
     * and handles all cleanup tasks relating to redis
     */
    public static async dockerStopHandler(container_id:string, state: "failed" | "success"){
        Logger.debug("Running docker stop redis hook")
        // Reminder: Container ID comprises:
        // iglu-builder_<build_id>_<node_id>
        const JOB_ID = container_id.split("_")[1]
        if(!JOB_ID){
            Logger.error(`Could not get Job ID from Container ID: ${container_id}. This is a bug.`)
            throw new Error(`Could not get Job ID from Container ID: ${container_id}.`)
        }

        //TODO: Update the job status in the database to either "failed" or "success" based on the state parameter
        // and then inform the controller that the job is done via REST API call
        Redis.removeJobFromRunning(JOB_ID)
    }
}