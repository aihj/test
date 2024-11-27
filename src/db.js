const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3001;
const mysql = require('mysql');
const cors = require('cors');
const router = express.Router();
const http = require('http')
const httpServer = require("http").createServer();

const io = require("socket.io")(httpServer, {
    cors : {
        origin :"*",
        methods: ["GET", "POST"],
        credentials :true
    }
});


const db = mysql.createPool({
    host : '192.168.0.120',
    port: 3308,
    user : 'hjkim',
    password : '123456',
    database : 'carenation_bak'
});
  
app.use(cors());

app.get('/', function(req,res) {
    res.sendFile(__dirname+ '../src/build/index.html');  /*빌드된 index.html을 빌려와 결과물 보여주는 프론트화면*/
});


io.on("connection", (socket) => {
    console.log("connect client by Socket.io");

    socket.on("event", req=> {
       
        const ptr_job_id = req.ptr_job_id;
        const cancel_request_at = req.cancel_request_at;
        const job_cancel_at = req.job_cancel_at;


        const query = `select 	
            ${ptr_job_id} as 공고번호
            , job_type as 서비스유형
            , penalty_tbl.ptr_users_id as 보호자ID, ptr_name 보호자이름, ptr_phone 보호자연락처, penalty_tbl.cgs_users_id 케어메이트ID, cgs_name 케어메이트이름, cgs_phone 케어메이트연락처
            , job_start_date as 공고시작일, job_end_date as 공고종료일
            
            , '${cancel_request_at}' as 취소요청시간
            , '${job_cancel_at}' as 취소종료일
            , penalty_hour as 위약금시간차
            , cal_penalty as 예상위약금
            
        from (
            select ptr_job_id, job_type, ptr_users_id, cgs_users_id, job_start_date, job_end_date
                , case when penalty_hour < 24 then 30000
                    when penalty_hour >= 24 and penalty_hour < 48 then 20000
                    when penalty_hour >= 48 and penalty_hour < 72 then 10000
                    else 0 end as cal_penalty
                , penalty_hour
            from (
                select id as ptr_job_id, job_type, ptr_users_id, cgs_users_id
                    , case when '${cancel_request_at}' >= job_start_date then job_cancel_at else job_start_date end as penalty_at
                    , case when '${cancel_request_at}' < created_at then null
                        when '${cancel_request_at}' >= job_start_date and '${cancel_request_at}' > '${job_cancel_at}' then -1
                        when '${cancel_request_at}' >= job_start_date then (timestampdiff(second, '${cancel_request_at}', '${job_cancel_at}')) / (60*60)
                        else timestampdiff(second, '${cancel_request_at}', job_start_date) / (60*60) 
                        end as penalty_hour
                    , job_start_date, job_end_date
                from ptr_job
                where id = ${ptr_job_id}
            ) penalty
        ) penalty_tbl

        join (select id as ptr_users_id, name as ptr_name, phone as ptr_phone from ptr_users) pu on penalty_tbl.ptr_users_id = pu.ptr_users_id

        join (select id as cgs_users_id, name as cgs_name, phone as cgs_phone from cgs_users) cu on penalty_tbl.cgs_users_id = cu.cgs_users_id`

        db.query(query, (err, data) => {
            
            socket.emit('data', data);
                        
        });

        const penalty_amount =30000;

        const query2 = `select ${ptr_job_id} as 공고번호
        , ${penalty_amount} as 위약금_선택    
    
        , 승인_보호자결제금액 as 총결제금액
        , if(job_start_date >= '${job_cancel_at}', '전체취소', '부분취소') as 취소유형
        , 승인_보호자결제금액 - 순승인_보호자결제금액 as 취소금액
        , ${penalty_amount} as 위약금
        , 승인_보호자결제금액 - 순승인_보호자결제금액 - ${penalty_amount} as 총취소금액
        
        , floor(act_work_min / 60) as 종료예상정보_총시간1_시간
        , act_work_min - (floor(act_work_min/60) * 60) as 종료예상정보_총시간1_분
        , case when job_type = 'day' then floor(act_work_min / 60 / 24) 
            else floor(act_work_min / sch_daily_work_min)
            end as 종료예상정보_총시간2_일
        , case when job_type = 'day' then floor(act_work_min / 60) - (floor(act_work_min/60/24)*24) 
            else act_work_min - (floor(act_work_min/sch_daily_work_min) *sch_daily_work_min)
            end as 종료예상정보_총시간2_시간
        
        , 순승인_보호자결제금액 + ${penalty_amount} as 종료예상정보_보호자총결제금액
        , 순승인_보호자결제금액 as 종료예상정보_서비스결제금액
        , ${penalty_amount} as 종료예상정보_위약금총액
        , floor((순승인_보호자결제금액 + ${penalty_amount}) * 0.024) + floor(floor((순승인_보호자결제금액 + ${penalty_amount}) * 0.024) * 0.1) as 종료예상정보_pg수수료
        , 순승인_보호자결제금액 + ${penalty_amount} - (floor((순승인_보호자결제금액 +${penalty_amount}) * 0.024) + floor(floor((순승인_보호자결제금액 + ${penalty_amount}) * 0.024) * 0.1)) as 종료예상정보_pg사입금금액
        
        , 순승인_보호자결제금액 +${penalty_amount} - (floor((순승인_보호자결제금액 + ${penalty_amount}) * 0.024) + floor(floor((순승인_보호자결제금액 + ${penalty_amount}) * 0.024) * 0.1)) 
            - (순승인_케어메이트비용 + ${penalty_amount} - floor(${penalty_amount} * 0.024) - floor(floor(${penalty_amount} * 0.024) * 0.1)) as 종료예상정보_신청인수수료
        
        , 순승인_케어메이트비용 +${penalty_amount} - floor((${penalty_amount} * 0.024)) - floor(floor(${penalty_amount} * 0.024) * 0.1) as 종료예상정보_총케어메이트비용
        , 순승인_케어메이트비용 as 종료예상정보_케어메이트비용서비스비용
        , ${penalty_amount} - floor(${penalty_amount} * 0.024) - floor(floor(${penalty_amount} * 0.024) * 0.1) as 종료예상정보_케어메이트위약금
        , floor(순승인_케어메이트비용 * cgs_fee_company_rate) + floor(${penalty_amount} * 0.3) - floor(${penalty_amount} * 0.024) - floor(floor(${penalty_amount} * 0.024) * 0.1) as 종료예상정보_총케어메이트수수료
        , floor(순승인_케어메이트비용 * cgs_fee_company_rate) as 종료예상정보_케어메이트서비스수수료
        , floor(${penalty_amount} * 0.3) - floor(${penalty_amount} * 0.024) - floor(floor(${penalty_amount} * 0.024) * 0.1) as 종료예상정보_케어메이트위약금수수료
        , 승인보험료 - 취소보험료 as 종료예상정보_보험료
        , 순승인_케어메이트비용 + ${penalty_amount}- (floor(순승인_케어메이트비용 * cgs_fee_company_rate) + floor(${penalty_amount} * 0.3)) - (승인보험료 - 취소보험료) as 종료예상정보_케어메이트총급여    
        
    from (
        select 
            cancel_fee_tbl.ptr_job_id, job_type, is_family, job_start_date, job_end_date
            , total_cancel_hour, total_cancel_min1, total_cancel_days, total_cancel_min2, sch_ins_days, cancel_ins_days, sch_daily_work_min
            , amount_day, amount_time#, total_work_hour
            , sch_work_min, act_work_min, cancel_work_min
            , case when is_family = 'Y' then 0
                when job_type in ('day', 'term') then sch_ins_days * 350
                else sch_ins_days * 980
                end as 승인보험료
            , case when is_family = 'Y' then 0
                when job_type in ('day', 'term') then cancel_ins_days * 350
                else cancel_ins_days * 980
                end as 취소보험료
            
            , ptr_fee_company_rate
            , if(job_type != 'donghaeng', cgs_fee_company_rate, 0.8) cgs_fee_company_rate	
            
            , fst_pay_amount as 승인_보호자결제금액
            , case when job_type = 'day' 
                then ceil(if(((sch_work_min/10 * amount_day/24/6) % 1 > 0.999999) | ((sch_work_min/10 * amount_day/24/6) % 1 < 0.000001),
                        round(sch_work_min/10 * amount_day/24/6), sch_work_min/10 * amount_day/24/6))
                else ceil(if(((sch_work_min/10 * amount_time/6) % 1 > 0.999999) | ((sch_work_min/10 * amount_time/6) % 1 < 0.000001),
                        round(sch_work_min/10 * amount_time/6), sch_work_min/10 * amount_time/6))
                end as 승인_케어메이트비용
            
            
            , case when job_type = 'day'
                then floor(if((act_work_min / 10 * (1+ptr_fee_company_rate) * amount_day/24/6 % 1 > 0.999999) | (act_work_min / 10 * (1+ptr_fee_company_rate) * amount_day/24/6 % 1 < 0.000001)
                    , round(act_work_min / 10 * (1+ptr_fee_company_rate) * amount_day/24/6), act_work_min / 10 * (1+ptr_fee_company_rate) * amount_day/24/6))
                else floor(if(((act_work_min/10) * (1+ptr_fee_company_rate) * amount_time/6 % 1 > 0.999999) | ((act_work_min/10) * (1+ptr_fee_company_rate) * amount_time/6 % 1 < 0.000001)
                        , round((act_work_min/10) * (1+ptr_fee_company_rate) * amount_time/6), (act_work_min/10) * (1+ptr_fee_company_rate) * amount_time/6))
                end as 순승인_보호자결제금액
            , case when job_type = 'day'
                then ceil(if(((act_work_min/10 * amount_day/24/6) % 1 > 0.999999) | ((act_work_min/10 * amount_day/24/6) % 1 < 0.000001),
                    round(act_work_min/10 * amount_day/24/6), act_work_min/10 * amount_day/24/6))
                else ceil(if(((act_work_min/10 * amount_time/6) % 1 > 0.999999) | ((act_work_min/10 * amount_time/6) % 1 < 0.000001),
                        round(act_work_min/10 * amount_time/6), act_work_min/10 * amount_time/6))
                end as 순승인_케어메이트비용
            
        from (
            select 
                pj.id as ptr_job_id, ptr_users_id, pj.cgs_users_id, job_type, is_family, job_start_date, job_end_date, pja.amount_time, pja.amount_day
                , if(job_type in ('day', 'term'), 0.06, if(job_type = 'donghaeng', 0.3, 0.08)) as ptr_fee_company_rate
            from ptr_job pj
            join (
                select ptr_job_id, cgs_users_id, amount_day, amount_time
                from ptr_job_applicant
                where status = 'choice' and deleted_at is null
            ) pja on pj.id = pja.ptr_job_id and pj.cgs_users_id = pja.cgs_users_id
            where pj.id = ${ptr_job_id}
        ) cancel_fee_tbl

        join (
            select max(ptr_job_id) ptr_job_id
                , floor(sum(total_cancel_min) / 60) as total_cancel_hour
                , sum(total_cancel_min) - 
                    floor(sum(total_cancel_min) / 60) * 60 as total_cancel_min1
                , sum(sch_day_num) as sch_ins_days
                , sum(cancel_day_num) as cancel_ins_days
                , sum(cancel_day_num) as total_cancel_days
                , if(max(case when total_cancel_min != 0 then total_cancel_min end) != min(case when total_cancel_min != 0 then total_cancel_min end)
                    , floor(min(total_cancel_min) / 60), 0) as total_cancel_min2
                
                , sum(sch_work_min) sch_work_min
                , case 
                    when max(job_type) = 'donghaeng' then sum(timestampdiff(minute, s_date, '${job_cancel_at}'))
                    else sum(sch_work_min) - sum(total_cancel_min)
                    end as act_work_min
                , case 
                    when max(job_type) = 'donghaeng' then (18 * 60) - sum(timestampdiff(minute, s_date,'${job_cancel_at}'))
                    else sum(total_cancel_min) 
                    end as cancel_work_min
                , min(sch_work_min) sch_daily_work_min
            
            from (
                select ptr_job_id, job_type
                    , if(job_type = 'donghaeng', job_start_date, s_date) s_date
                    , case 
                        when job_type = 'donghaeng' and status != 4 then job_end_date
                        when job_type = 'donghaeng' and status = 4 then job_cancel_at
                        else e_date end as e_date
                    , s_date_nxt, e_date_nxt, '${job_cancel_at}'
                    , case when job_type = 'donghaeng' then 18 * 60 else timestampdiff(minute, s_date, e_date) end as sch_work_min
                    , case when s_date >= '${job_cancel_at}' then timestampdiff(minute, s_date, e_date)
                        when job_type = 'day' and '${job_cancel_at}' < e_date then timestampdiff(minute, '${job_cancel_at}', e_date)
                        when job_type != 'day' and e_date > '${job_cancel_at}' and s_date < '${job_cancel_at}' then timestampdiff(minute, '${job_cancel_at}', e_date)
                        else 0
                        end as total_cancel_min
                    , case when job_type = 'donghaeng' then 1
                        when job_type = 'day' then datediff(e_date, s_date) + 1
                        when date(s_date) != date(e_date) and (s_date_nxt is null or date(s_date) != date(e_date_nxt)) then 2
                        when date(s_date) != date(e_date) and date(e_date_nxt) = date(s_date) then 1
                        when date(s_date) = date(e_date) and s_date_nxt is null then 1
                        when date(s_date) = date(e_date) and date(s_date) = date(e_date_nxt) then 0
                        when date(s_date) = date(e_date) and date(s_date) != date(e_date_nxt) then 1
                        end as sch_day_num
                    , case 
                        when job_type = 'day' and s_date = '${job_cancel_at}' then datediff('${job_cancel_at}', e_date) + 1
                        when job_type = 'day' and s_date != '${job_cancel_at}' then datediff(e_date, '${job_cancel_at}')
                        when job_type = 'donghaeng' and s_date = '${job_cancel_at}' then 1
                        when job_type = 'donghaeng' then 0
                        
                        when date(e_date) < date('${job_cancel_at}') then 0
                        
                        when date(s_date) = date('${job_cancel_at}') and s_date_nxt is null and e_date <= '${job_cancel_at}' then 0
                        when date(s_date) = date('${job_cancel_at}') and s_date_nxt is null and date(s_date) != date(e_date) then 2
                        when date(s_date) = date('${job_cancel_at}') and s_date_nxt is null and date(s_date) = date(e_date) then 1
                        
                        when date(s_date) = date('${job_cancel_at}') and date(s_date) != date(e_date) then 1
                        when date(s_date) = date('${job_cancel_at}') and date(s_date) = date(e_date) then 0
                        when date(s_date) > date('${job_cancel_at}') and date(s_date) != date(e_date_nxt) and date(s_date) != date(e_date) then 2
                        when date(s_date) > date('${job_cancel_at}') and date(s_date) != date(e_date_nxt) and date(s_date) = date(e_date) then 1
                        when date(s_date) > date('${job_cancel_at}') and date(s_date) = date(e_date_nxt) and date(s_date) != date(e_date) then 1
                        when date(s_date) > date('${job_cancel_at}') and date(s_date) = date(e_date_nxt) and date(s_date) = date(e_date) then 0
                        end as cancel_day_num
                from (select * 
                    from ptr_job_schedule
                    where ptr_job_id = ${ptr_job_id}) pjs1
                left join (select \`order\` +1 as nxt_order, s_date s_date_nxt, e_date e_date_nxt from ptr_job_schedule where ptr_job_id = ${ptr_job_id}) pjs2 on pjs1.\`order\` = pjs2.nxt_order
                left join (select id, job_start_date, job_end_date, job_cancel_at, status from ptr_job where job_type = 'donghaeng' and id =${ptr_job_id}) pj on pjs1.ptr_job_id = pj.id
                    
            ) work_sch
        ) cancel_time_tbl on cancel_fee_tbl.ptr_job_id = cancel_time_tbl.ptr_job_id
        
        left join (select ptr_job_id, max(fee_company) / max(amount+fee_insurance+fee_company) cgs_fee_company_rate from cgs_payment where ptr_job_id =${ptr_job_id} group by ptr_job_id) as cgs_fcr
            on cancel_fee_tbl.ptr_job_id = cgs_fcr.ptr_job_id
        join (select ptr_job_id, amount as fst_pay_amount from ptr_payment where status = 2 and deleted_at is null and ptr_job_id = ${ptr_job_id}) pp on cancel_fee_tbl.ptr_job_id = pp.ptr_job_id

    ) calculator;`;

    db.query(query2, (err, data) => {
            
        socket.emit('data2', data);
                    
    });        
 

});    
});


httpServer.listen(4000);
    

app.get('/request', (req, res) => {

    const ptr_job_id = 419098;
    const job_cancel_at = '2024-11-02 08:00:00';
    const cancel_request_at = '2024-11-04 01:00:00';
    const penalty_amount = 30000;
    

    const query = `select ${ptr_job_id} as 공고번호
    , ${penalty_amount} as 위약금_선택    
  
    , 승인_보호자결제금액 as 총결제금액
    , if(job_start_date >= '${job_cancel_at}', '전체취소', '부분취소') as 취소유형
    , 승인_보호자결제금액 - 순승인_보호자결제금액 as 취소금액
    , ${penalty_amount} as 위약금
    , 승인_보호자결제금액 - 순승인_보호자결제금액 - ${penalty_amount} as 총취소금액
    
    , floor(act_work_min / 60) as 종료예상정보_총시간1_시간
    , act_work_min - (floor(act_work_min/60) * 60) as 종료예상정보_총시간1_분
    , case when job_type = 'day' then floor(act_work_min / 60 / 24) 
		else floor(act_work_min / sch_daily_work_min)
		end as 종료예상정보_총시간2_일
    , case when job_type = 'day' then floor(act_work_min / 60) - (floor(act_work_min/60/24)*24) 
		else act_work_min - (floor(act_work_min/sch_daily_work_min) *sch_daily_work_min)
		end as 종료예상정보_총시간2_시간
	
    , 순승인_보호자결제금액 + ${penalty_amount} as 종료예상정보_보호자총결제금액
    , 순승인_보호자결제금액 as 종료예상정보_서비스결제금액
    , ${penalty_amount} as 종료예상정보_위약금총액
    , floor((순승인_보호자결제금액 + ${penalty_amount}) * 0.024) + floor(floor((순승인_보호자결제금액 + ${penalty_amount}) * 0.024) * 0.1) as 종료예상정보_pg수수료
    , 순승인_보호자결제금액 + ${penalty_amount} - (floor((순승인_보호자결제금액 +${penalty_amount}) * 0.024) + floor(floor((순승인_보호자결제금액 + ${penalty_amount}) * 0.024) * 0.1)) as 종료예상정보_pg사입금금액
    
    , 순승인_보호자결제금액 +${penalty_amount} - (floor((순승인_보호자결제금액 + ${penalty_amount}) * 0.024) + floor(floor((순승인_보호자결제금액 + ${penalty_amount}) * 0.024) * 0.1)) 
		- (순승인_케어메이트비용 + ${penalty_amount} - floor(${penalty_amount} * 0.024) - floor(floor(${penalty_amount} * 0.024) * 0.1)) as 종료예상정보_신청인수수료
	
    , 순승인_케어메이트비용 +${penalty_amount} - floor((${penalty_amount} * 0.024)) - floor(floor(${penalty_amount} * 0.024) * 0.1) as 종료예상정보_총케어메이트비용
    , 순승인_케어메이트비용 as 종료예상정보_케어메이트비용서비스비용
    , ${penalty_amount} - floor(${penalty_amount} * 0.024) - floor(floor(${penalty_amount} * 0.024) * 0.1) as 종료예상정보_케어메이트위약금
    , floor(순승인_케어메이트비용 * cgs_fee_company_rate) + floor(${penalty_amount} * 0.3) - floor(${penalty_amount} * 0.024) - floor(floor(${penalty_amount} * 0.024) * 0.1) as 종료예상정보_총케어메이트수수료
    , floor(순승인_케어메이트비용 * cgs_fee_company_rate) as 종료예상정보_케어메이트서비스수수료
    , floor(${penalty_amount} * 0.3) - floor(${penalty_amount} * 0.024) - floor(floor(${penalty_amount} * 0.024) * 0.1) as 종료예상정보_케어메이트위약금수수료
    , 승인보험료 - 취소보험료 as 종료예상정보_보험료
    , 순승인_케어메이트비용 + ${penalty_amount}- (floor(순승인_케어메이트비용 * cgs_fee_company_rate) + floor(${penalty_amount} * 0.3)) - (승인보험료 - 취소보험료) as 종료예상정보_케어메이트총급여    
    
from (
	select 
		cancel_fee_tbl.ptr_job_id, job_type, is_family, job_start_date, job_end_date
        , total_cancel_hour, total_cancel_min1, total_cancel_days, total_cancel_min2, sch_ins_days, cancel_ins_days, sch_daily_work_min
        , amount_day, amount_time#, total_work_hour
        , sch_work_min, act_work_min, cancel_work_min
        , case when is_family = 'Y' then 0
			when job_type in ('day', 'term') then sch_ins_days * 350
            else sch_ins_days * 980
            end as 승인보험료
        , case when is_family = 'Y' then 0
			when job_type in ('day', 'term') then cancel_ins_days * 350
			else cancel_ins_days * 980
			end as 취소보험료
		
        , ptr_fee_company_rate
        , if(job_type != 'donghaeng', cgs_fee_company_rate, 0.8) cgs_fee_company_rate	
        
        , fst_pay_amount as 승인_보호자결제금액
        , case when job_type = 'day' 
 			then ceil(if(((sch_work_min/10 * amount_day/24/6) % 1 > 0.999999) | ((sch_work_min/10 * amount_day/24/6) % 1 < 0.000001),
 					round(sch_work_min/10 * amount_day/24/6), sch_work_min/10 * amount_day/24/6))
			else ceil(if(((sch_work_min/10 * amount_time/6) % 1 > 0.999999) | ((sch_work_min/10 * amount_time/6) % 1 < 0.000001),
 					round(sch_work_min/10 * amount_time/6), sch_work_min/10 * amount_time/6))
 			end as 승인_케어메이트비용
        
        
        , case when job_type = 'day'
            then floor(if((act_work_min / 10 * (1+ptr_fee_company_rate) * amount_day/24/6 % 1 > 0.999999) | (act_work_min / 10 * (1+ptr_fee_company_rate) * amount_day/24/6 % 1 < 0.000001)
				, round(act_work_min / 10 * (1+ptr_fee_company_rate) * amount_day/24/6), act_work_min / 10 * (1+ptr_fee_company_rate) * amount_day/24/6))
  			else floor(if(((act_work_min/10) * (1+ptr_fee_company_rate) * amount_time/6 % 1 > 0.999999) | ((act_work_min/10) * (1+ptr_fee_company_rate) * amount_time/6 % 1 < 0.000001)
  					, round((act_work_min/10) * (1+ptr_fee_company_rate) * amount_time/6), (act_work_min/10) * (1+ptr_fee_company_rate) * amount_time/6))
			end as 순승인_보호자결제금액
		, case when job_type = 'day'
			 then ceil(if(((act_work_min/10 * amount_day/24/6) % 1 > 0.999999) | ((act_work_min/10 * amount_day/24/6) % 1 < 0.000001),
				round(act_work_min/10 * amount_day/24/6), act_work_min/10 * amount_day/24/6))
 			else ceil(if(((act_work_min/10 * amount_time/6) % 1 > 0.999999) | ((act_work_min/10 * amount_time/6) % 1 < 0.000001),
 					round(act_work_min/10 * amount_time/6), act_work_min/10 * amount_time/6))
             end as 순승인_케어메이트비용
        
	from (
		select 
			pj.id as ptr_job_id, ptr_users_id, pj.cgs_users_id, job_type, is_family, job_start_date, job_end_date, pja.amount_time, pja.amount_day
            , if(job_type in ('day', 'term'), 0.06, if(job_type = 'donghaeng', 0.3, 0.08)) as ptr_fee_company_rate
		from ptr_job pj
		join (
			select ptr_job_id, cgs_users_id, amount_day, amount_time
			from ptr_job_applicant
			where status = 'choice' and deleted_at is null
		) pja on pj.id = pja.ptr_job_id and pj.cgs_users_id = pja.cgs_users_id
		where pj.id = ${ptr_job_id}
	) cancel_fee_tbl

	join (
		select max(ptr_job_id) ptr_job_id
			, floor(sum(total_cancel_min) / 60) as total_cancel_hour
			, sum(total_cancel_min) - 
				floor(sum(total_cancel_min) / 60) * 60 as total_cancel_min1
			, sum(sch_day_num) as sch_ins_days
			, sum(cancel_day_num) as cancel_ins_days
			, sum(cancel_day_num) as total_cancel_days
			, if(max(case when total_cancel_min != 0 then total_cancel_min end) != min(case when total_cancel_min != 0 then total_cancel_min end)
				, floor(min(total_cancel_min) / 60), 0) as total_cancel_min2
            
			, sum(sch_work_min) sch_work_min
            , case 
				when max(job_type) = 'donghaeng' then sum(timestampdiff(minute, s_date, '${job_cancel_at}'))
                else sum(sch_work_min) - sum(total_cancel_min)
                end as act_work_min
            , case 
				when max(job_type) = 'donghaeng' then (18 * 60) - sum(timestampdiff(minute, s_date,'${job_cancel_at}'))
                else sum(total_cancel_min) 
                end as cancel_work_min
			, min(sch_work_min) sch_daily_work_min
		
		from (
			select ptr_job_id, job_type
				, if(job_type = 'donghaeng', job_start_date, s_date) s_date
                , case 
					when job_type = 'donghaeng' and status != 4 then job_end_date
                    when job_type = 'donghaeng' and status = 4 then job_cancel_at
                    else e_date end as e_date
                , s_date_nxt, e_date_nxt, '${job_cancel_at}'
				, case when job_type = 'donghaeng' then 18 * 60 else timestampdiff(minute, s_date, e_date) end as sch_work_min
				, case when s_date >= '${job_cancel_at}' then timestampdiff(minute, s_date, e_date)
					when job_type = 'day' and '${job_cancel_at}' < e_date then timestampdiff(minute, '${job_cancel_at}', e_date)
					when job_type != 'day' and e_date > '${job_cancel_at}' and s_date < '${job_cancel_at}' then timestampdiff(minute, '${job_cancel_at}', e_date)
					else 0
					end as total_cancel_min
				, case when job_type = 'donghaeng' then 1
					when job_type = 'day' then datediff(e_date, s_date) + 1
                    when date(s_date) != date(e_date) and (s_date_nxt is null or date(s_date) != date(e_date_nxt)) then 2
                    when date(s_date) != date(e_date) and date(e_date_nxt) = date(s_date) then 1
                    when date(s_date) = date(e_date) and s_date_nxt is null then 1
                    when date(s_date) = date(e_date) and date(s_date) = date(e_date_nxt) then 0
                    when date(s_date) = date(e_date) and date(s_date) != date(e_date_nxt) then 1
					end as sch_day_num
				, case 
                    when job_type = 'day' and s_date = '${job_cancel_at}' then datediff('${job_cancel_at}', e_date) + 1
                    when job_type = 'day' and s_date != '${job_cancel_at}' then datediff(e_date, '${job_cancel_at}')
                    when job_type = 'donghaeng' and s_date = '${job_cancel_at}' then 1
                    when job_type = 'donghaeng' then 0
                     
					when date(e_date) < date('${job_cancel_at}') then 0
                    
                    when date(s_date) = date('${job_cancel_at}') and s_date_nxt is null and e_date <= '${job_cancel_at}' then 0
                    when date(s_date) = date('${job_cancel_at}') and s_date_nxt is null and date(s_date) != date(e_date) then 2
                    when date(s_date) = date('${job_cancel_at}') and s_date_nxt is null and date(s_date) = date(e_date) then 1
                    
                    when date(s_date) = date('${job_cancel_at}') and date(s_date) != date(e_date) then 1
                    when date(s_date) = date('${job_cancel_at}') and date(s_date) = date(e_date) then 0
                    when date(s_date) > date('${job_cancel_at}') and date(s_date) != date(e_date_nxt) and date(s_date) != date(e_date) then 2
                    when date(s_date) > date('${job_cancel_at}') and date(s_date) != date(e_date_nxt) and date(s_date) = date(e_date) then 1
                    when date(s_date) > date('${job_cancel_at}') and date(s_date) = date(e_date_nxt) and date(s_date) != date(e_date) then 1
                    when date(s_date) > date('${job_cancel_at}') and date(s_date) = date(e_date_nxt) and date(s_date) = date(e_date) then 0
					end as cancel_day_num
			from (select * 
				from ptr_job_schedule
				where ptr_job_id = ${ptr_job_id}) pjs1
			left join (select \`order\` +1 as nxt_order, s_date s_date_nxt, e_date e_date_nxt from ptr_job_schedule where ptr_job_id = ${ptr_job_id}) pjs2 on pjs1.\`order\` = pjs2.nxt_order
            left join (select id, job_start_date, job_end_date, job_cancel_at, status from ptr_job where job_type = 'donghaeng' and id =${ptr_job_id}) pj on pjs1.ptr_job_id = pj.id
				
		) work_sch
	) cancel_time_tbl on cancel_fee_tbl.ptr_job_id = cancel_time_tbl.ptr_job_id
    
    left join (select ptr_job_id, max(fee_company) / max(amount+fee_insurance+fee_company) cgs_fee_company_rate from cgs_payment where ptr_job_id =${ptr_job_id} group by ptr_job_id) as cgs_fcr
		on cancel_fee_tbl.ptr_job_id = cgs_fcr.ptr_job_id
    join (select ptr_job_id, amount as fst_pay_amount from ptr_payment where status = 2 and deleted_at is null and ptr_job_id = ${ptr_job_id}) pp on cancel_fee_tbl.ptr_job_id = pp.ptr_job_id

) calculator;`;


    db.query(query, (err, data) => {
        if (err) {
            console.log('err');
            res.send(err);
        } else{
            console.log('success');
            res.send(data);
        }
    });
});

app.listen(port, ()=>{
    console.log(`Connect at http://127.0.0.1:${port}`);

});