import {Client} from "pg";
import 'dotenv/config'
import type {builderDatabase, builderFrontendPackage, dbBuilder} from "@/types/db";
import * as process from "node:process";

export default class Database{
    client: Client;

    constructor(){
        console.log(process.env.DATABASE_URL)
        if(!process.env.DATABASE_URL){
            console.error('DATABASE_URL not set');
            process.exit(1)
        }

        this.client = new Client(
            {
                connectionString: process.env.DATABASE_URL,
            }
        );
        this.client.connect().then(() => {
            console.log('Connected to database');
        }).catch((err) => {
            console.error('Error connecting to database', err);
            throw new Error(`Error connecting to database ${err}`)
        });
    }

    async close(){
        console.log('Database closed');
        await this.client.end();
    }
    async connect(){
        console.log('Connecting to database');
        await this.client.connect();
        console.log('Connected to database');
    }

    /*
    * This function gets all builders from the database and returns them
    * */
    public async getAllBuilders():Promise<Array<builderDatabase>>{
        const res:Array<builderDatabase> = await this.client.query(`
            SELECT row_to_json(cb.*) as builder, row_to_json(cc.*) as cachix, row_to_json(bo.*) as buildoptions, row_to_json(gc.*) as git, row_to_json(ca.*) as cache
            FROM cache.builder cb
                     INNER JOIN cache.git_configs gc ON gc.builder_id = cb.id
                     INNER JOIN cache.cachixconfigs cc ON cc.builder_id = cb.id
                     INNER JOIN cache.buildoptions bo ON bo.builder_id = cb.id
                     INNER JOIN cache.caches ca ON ca.id = cc.target
            GROUP BY cb.id, cc.id, bo.id, gc.id, ca.id;
        `).then((res)=>{
            return res.rows
        })
        return res
    }

    public async createBuilderRun(builderId:number, gitCommit:string, status:string, log:string):Promise<number>{
        return await this.client.query(`
            INSERT INTO cache.builder_runs (builder_id, gitcommit, status, log, duration)
                VALUES($1, $2, $3, $4, $5)
            RETURNING id;
        `, [builderId, gitCommit, status, log, 0]).then((res)=>{
            console.log(res.rows[0])
            return res.rows[0].id;
        })
    }

    public async updateBuilderRun(builderRunID:number, status:string, log:string){
        await this.client.query(`
            UPDATE cache.builder_runs
            SET status = $1, log = $2, duration = age(now(), (SELECT started_at FROM cache.builder_runs WHERE id = $3)), ended_at = now()
            WHERE id = $3;;
        `, [status, log, builderRunID]);
    }

    public async getBuilderRun(runID:string):Promise<{
        id: number,
        builder_id: number,
        status: string,
        started_at: Date,
        ended_at: Date | null,
        gitcommit: string,
        duration: string,
        log: string
    }>{
        const res = await this.client.query(`
            SELECT * FROM cache.builder_runs WHERE id = $1
        `, [runID]);

        if(res.rows.length === 0){
            throw new Error("Builder run not found");
        }

        return res.rows[0];
    }

}