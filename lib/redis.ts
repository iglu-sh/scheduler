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
    constructor(client: RedisClientType) {
        Redis.client = client
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

    public static async getBuildConfig(build_config_id:number):combinedBuilder{
        
    }

    public addBuilderToRunning(job_id:string, builder_id:string, container_id:string): void{
        Redis.runningBuilders.push({
            job_id,
            builder_id,
            container_id
        })
        this.checkForNewJobs()
    }
    // Removes the job with the specified job_id from the running builders list and checks for new jobs
    public removeJobFromRunning(job_id:string): void{
        Redis.runningBuilders = Redis.runningBuilders.filter(builder => builder.job_id !== job_id);
        this.checkForNewJobs()
    }
    public removeBuilderFromQueue(job_id:string):void{
        // Remove the builder with the specified job_id from the queued builds list in Redis and add it to the running builders list
        Redis.client.json.get(`node:${Redis.node_id}:queued_builds`).then((queued_builds:any) => {
            if(!queued_builds){
                return
            }
            const new_queue = queued_builds.filter((build:any) => build.job_id !== job_id)
            Redis.client.json.set(`node:${Redis.node_id}:queued_builds`, '.', new_queue)
        })
    }
    public checkForNewJobs():void{
        // Check the node:<node_id>:queued_builds list for new jobs and see if we can start any of them
        // We can only start a new job if we are below the MAX_BUILDS limit
        const max_builds = parseInt(process.env.MAX_BUILDS!)
        if(Redis.runningBuilders.length >= max_builds){
            return
        }

        // Get the queued builds from Redis
        const queued_builders:queueEntry[] = Redis.client.json.get(`node:${Redis.node_id}:queued_builds`).catch((err)=>{
            Logger.error("Failed to fetch queued builders. Is your Redis instance reachable?")
            Logger.debug(`Redis Error: ${err}`)
            return []
        })

        // If the length is zero then we can just exit
        if(queued_builders.length === 0 || !queued_builders[0]){
            Logger.debug(`No builds in queue.`)
            return
        }

        // If the length is more than zero we call the start function.
        const job_id = queued_builders[0].job_id
        const builder_config_id = queued_builders[0].build_config_id
        await start(builder_config_id, job_id)
    }
    public async dockerStartHandler(job_id:string){

    }
    /*
     * Handles the exit of a specific container. It removes the Job from the running builders array in redis,
     * and handles all cleanup tasks relating to redis
     */
    public async dockerStopHandler(container_id:string){
        // Reminder: Container ID is comprised of:
        // iglu-builder_<build_id>_<node_id>
        const JOB_ID = container_id.split("_")[1]
        if(!JOB_ID){
            Logger.error(`Could not get Job ID from Container ID: ${container_id}. This is a bug.`)
            throw new Error(`Could not get Job ID from Container ID: ${container_id}.`)
        }
        assert(JOB_ID)


    }
}