import type {RedisClientType} from "redis";

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
        Redis.client.json.get(`node:${Redis.node_id}:queued_builds`).then((queued_builds:any) => {

        })
    }
}