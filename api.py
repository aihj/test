import pandas as pd
import pymysql
from sqlalchemy import create_engine, text
import requests
from datetime import datetime
import json
from flask import Flask, request,jsonify, render_template
from flask_cors import CORS



pymysql.install_as_MySQLdb()
HOSTNAME = '192.168.0.120'
PORT = 3308
USERNAME = 'hjkim'
PASSWORD = '123456'
DATABASE = 'carenation_bak'
CHARSET1 = 'utf8'

con_str_fmt = 'mysql+mysqldb://{0}:{1}@{2}:{3}/{4}?charset={5}'
con_str = con_str_fmt.format(USERNAME, PASSWORD, HOSTNAME, PORT, DATABASE, CHARSET1)

engine = create_engine(con_str)
conn = engine.connect()





app = Flask(__name__)
CORS(app, origins="http://localhost:3000", supports_credentials=True, methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])


#서비스

@app.route("/")
def get_home():

    return "yes"


@app.route("/info/<int:id>/<string:cancel>/<string:req_at>", methods=['GET'])
def get_data(id, cancel, req_at):       

    
    ptr_job_id = id
    job_cancel_at = cancel
    cancel_request_at = req_at

    qry = f"""select 
        
        {ptr_job_id} as 공고번호
        , job_type as 서비스유형
        , penalty_tbl.ptr_users_id as 보호자ID, ptr_name 보호자이름, ptr_phone 보호자연락처, penalty_tbl.cgs_users_id 케어메이트ID, cgs_name 케어메이트이름, cgs_phone 케어메이트연락처
        , job_start_date as 공고시작일, job_end_date as 공고종료일
        
        , '{cancel_request_at}' as 취소요청시간
        , '{job_cancel_at}' as 취소종료일
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
                , case when '{cancel_request_at}' >= job_start_date then job_cancel_at else job_start_date end as penalty_at
                , case when '{cancel_request_at}' < created_at then null
                    when '{cancel_request_at}' >= job_start_date and '{cancel_request_at}' > '{job_cancel_at}' then -1
                    when '{cancel_request_at}' >= job_start_date then (timestampdiff(second, '{cancel_request_at}', '{job_cancel_at}')) / (60*60)
                    else timestampdiff(second, @cancel_request_at, job_start_date) / (60*60) 
                    end as penalty_hour
                , job_start_date, job_end_date
            from ptr_job
            where id = {ptr_job_id}
        ) penalty
    ) penalty_tbl

    join (select id as ptr_users_id, name as ptr_name, phone as ptr_phone from ptr_users) pu on penalty_tbl.ptr_users_id = pu.ptr_users_id

    join (select id as cgs_users_id, name as cgs_name, phone as cgs_phone from cgs_users) cu on penalty_tbl.cgs_users_id = cu.cgs_users_id"""

    df = pd.read_sql_query(qry, engine)


    d = json.loads(df.to_json(orient='records'))
    
    d[0]['예상위약금'] = format(d[0]['예상위약금'], ',d')    
    for i in range(len(d)):
        
        d[i]['공고시작일'] = datetime.fromtimestamp(d[i]['공고시작일']/1000).strftime("%Y-%m-%d")
        d[i]['공고종료일'] = datetime.fromtimestamp(d[i]['공고종료일']/1000).strftime("%Y-%m-%d")


    return d

@app.route("/price/<int:id>/<string:cancel>/<int:penalty>", methods=['GET'])
def get_price(id, cancel, penalty):       

    ptr_job_id = id 	
    job_cancel_at = cancel
    penalty_amount = penalty	

    qry2 = f"""select {ptr_job_id} as 공고번호, {penalty_amount} as 위약금_선택
    , 승인_보호자결제금액 as 총결제금액
    , if(job_start_date >= '{job_cancel_at}', '전체취소', '부분취소') as 취소유형		# 근무 시작 시간보다 취소 요청한 종료 시간이 같거나 빠른 경우: 전체취소
    , 승인_보호자결제금액 - 순승인_보호자결제금액 as 취소금액
    , {penalty_amount} as 위약금
    , 승인_보호자결제금액 - 순승인_보호자결제금액 - {penalty_amount} as 총취소금액
    
    , floor(act_work_min / 60) as 종료예상정보_총시간1_시간
    , act_work_min - (floor(act_work_min/60) * 60) as 종료예상정보_총시간1_분
    , case when job_type = 'day' then floor(act_work_min / 60 / 24) 
        else floor(act_work_min / sch_daily_work_min)
        end as 종료예상정보_총시간2_일
    , case when job_type = 'day' then floor(act_work_min / 60) - (floor(act_work_min/60/24)*24) 
        else act_work_min - (floor(act_work_min/sch_daily_work_min) *sch_daily_work_min)
        end as 종료예상정보_총시간2_시간
    
    , 순승인_보호자결제금액 + {penalty_amount} as 종료예상정보_보호자총결제금액
    , 순승인_보호자결제금액 as 종료예상정보_서비스결제금액
    , {penalty_amount} as 종료예상정보_위약금총액
    , floor((순승인_보호자결제금액 + {penalty_amount}) * 0.024) + floor(floor((순승인_보호자결제금액 + {penalty_amount}) * 0.024) * 0.1) as 종료예상정보_pg수수료
    , 순승인_보호자결제금액 + {penalty_amount} - (floor((순승인_보호자결제금액 +{penalty_amount}) * 0.024) + floor(floor((순승인_보호자결제금액 + {penalty_amount}) * 0.024) * 0.1)) as 종료예상정보_pg사입금금액
    
    , 순승인_보호자결제금액 +{penalty_amount} - (floor((순승인_보호자결제금액 + {penalty_amount}) * 0.024) + floor(floor((순승인_보호자결제금액 + {penalty_amount}) * 0.024) * 0.1)) # pg사 입금금액
        - (순승인_케어메이트비용 + {penalty_amount} - floor({penalty_amount} * 0.024) - floor(floor({penalty_amount} * 0.024) * 0.1)) /* 총 케어메이트 비용 */ as 종료예상정보_신청인수수료
    
    , 순승인_케어메이트비용 +{penalty_amount} - floor(({penalty_amount} * 0.024)) - floor(floor({penalty_amount} * 0.024) * 0.1) as 종료예상정보_총케어메이트비용
    , 순승인_케어메이트비용 as 종료예상정보_케어메이트비용서비스비용
    , {penalty_amount} - floor({penalty_amount} * 0.024) - floor(floor({penalty_amount} * 0.024) * 0.1) as 종료예상정보_케어메이트위약금
    , floor(순승인_케어메이트비용 * cgs_fee_company_rate) + floor({penalty_amount} * 0.3) - floor({penalty_amount} * 0.024) - floor(floor({penalty_amount} * 0.024) * 0.1) as 종료예상정보_총케어메이트수수료
    , floor(순승인_케어메이트비용 * cgs_fee_company_rate) as 종료예상정보_케어메이트서비스수수료
    , floor({penalty_amount} * 0.3) - floor({penalty_amount} * 0.024) - floor(floor({penalty_amount} * 0.024) * 0.1) as 종료예상정보_케어메이트위약금수수료
    , 승인보험료 - 취소보험료 as 종료예상정보_보험료
    , 순승인_케어메이트비용 + {penalty_amount}- (floor(순승인_케어메이트비용 * cgs_fee_company_rate) + floor({penalty_amount} * 0.3)) - (승인보험료 - 취소보험료) as 종료예상정보_케어메이트총급여    
    
    from (select 
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
            # 수수료
            , ptr_fee_company_rate
            , if(job_type != 'donghaeng', cgs_fee_company_rate, 0.8) cgs_fee_company_rate	
            
            ## 보호자, 간병인 기본 금액 계산
            # 1) 취소 전 금액
            , fst_pay_amount as 승인_보호자결제금액	# 보호자 첫 결제 금액
            , case when job_type = 'day' 
                then ceil(if(((sch_work_min/10 * amount_day/24/6) %% 1 > 0.999999) | ((sch_work_min/10 * amount_day/24/6) %% 1 < 0.000001),
                        round(sch_work_min/10 * amount_day/24/6), sch_work_min/10 * amount_day/24/6))
                else ceil(if(((sch_work_min/10 * amount_time/6) %% 1 > 0.999999) | ((sch_work_min/10 * amount_time/6) %% 1 < 0.000001),
                        round(sch_work_min/10 * amount_time/6), sch_work_min/10 * amount_time/6))
                end as 승인_케어메이트비용
            
            # 2) 최종 결제 금액
            , case when job_type = 'day'
                then floor(if((act_work_min / 10 * (1+ptr_fee_company_rate) * amount_day/24/6 %% 1 > 0.999999) | (act_work_min / 10 * (1+ptr_fee_company_rate) * amount_day/24/6 %% 1 < 0.000001)
                    , round(act_work_min / 10 * (1+ptr_fee_company_rate) * amount_day/24/6), act_work_min / 10 * (1+ptr_fee_company_rate) * amount_day/24/6))
                else floor(if(((act_work_min/10) * (1+ptr_fee_company_rate) * amount_time/6 %% 1 > 0.999999) | ((act_work_min/10) * (1+ptr_fee_company_rate) * amount_time/6 %% 1 < 0.000001)
                        , round((act_work_min/10) * (1+ptr_fee_company_rate) * amount_time/6), (act_work_min/10) * (1+ptr_fee_company_rate) * amount_time/6))
                end as 순승인_보호자결제금액
            , case when job_type = 'day'
                then ceil(if(((act_work_min/10 * amount_day/24/6) %% 1 > 0.999999) | ((act_work_min/10 * amount_day/24/6) %% 1 < 0.000001),
                    round(act_work_min/10 * amount_day/24/6), act_work_min/10 * amount_day/24/6))
                else ceil(if(((act_work_min/10 * amount_time/6) %% 1 > 0.999999) | ((act_work_min/10 * amount_time/6) %% 1 < 0.000001),
                        round(act_work_min/10 * amount_time/6), act_work_min/10 * amount_time/6))
                end as 순승인_케어메이트비용
            
        ## 단위 금액
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
            where pj.id = {ptr_job_id}
        ) cancel_fee_tbl
        ## 시간 정보
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
                    when max(job_type) = 'donghaeng' then sum(timestampdiff(minute, s_date, '{job_cancel_at}'))
                    else sum(sch_work_min) - sum(total_cancel_min)
                    end as act_work_min
                , case 
                    when max(job_type) = 'donghaeng' then (18 * 60) - sum(timestampdiff(minute, s_date,'{job_cancel_at}'))
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
                    , s_date_nxt, e_date_nxt, '{job_cancel_at}'
                    , case when job_type = 'donghaeng' then 18 * 60 else timestampdiff(minute, s_date, e_date) end as sch_work_min
                    , case when s_date >= '{job_cancel_at}' then timestampdiff(minute, s_date, e_date)
                        when job_type = 'day' and '{job_cancel_at}' < e_date then timestampdiff(minute, '{job_cancel_at}', e_date)
                        when job_type != 'day' and e_date > '{job_cancel_at}' and s_date < @job_cancel_at then timestampdiff(minute, '{job_cancel_at}', e_date)
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
                        when job_type = 'day' and s_date = '{job_cancel_at}' then datediff('{job_cancel_at}', e_date) + 1
                        when job_type = 'day' and s_date != '{job_cancel_at}' then datediff(e_date, '{job_cancel_at}')
                        when job_type = 'donghaeng' and s_date = '{job_cancel_at}' then 1		# 동행 전체 취소 : 취소일 1
                        when job_type = 'donghaeng' then 0						# 동행 진행 : 취소일 0
                        
                        when date(e_date) < date('{job_cancel_at}') then 0
                        
                        when date(s_date) = date('{job_cancel_at}') and s_date_nxt is null and e_date <= '{job_cancel_at}' then 0
                        when date(s_date) = date('{job_cancel_at}') and s_date_nxt is null and date(s_date) != date(e_date) then 2
                        when date(s_date) = date('{job_cancel_at}') and s_date_nxt is null and date(s_date) = date(e_date) then 1
                        
                        when date(s_date) = date('{job_cancel_at}') and date(s_date) != date(e_date) then 1
                        when date(s_date) = date('{job_cancel_at}') and date(s_date) = date(e_date) then 0
                        when date(s_date) > date('{job_cancel_at}') and date(s_date) != date(e_date_nxt) and date(s_date) != date(e_date) then 2
                        when date(s_date) > date('{job_cancel_at}') and date(s_date) != date(e_date_nxt) and date(s_date) = date(e_date) then 1
                        when date(s_date) > date('{job_cancel_at}') and date(s_date) = date(e_date_nxt) and date(s_date) != date(e_date) then 1
                        when date(s_date) > date('{job_cancel_at}') and date(s_date) = date(e_date_nxt) and date(s_date) = date(e_date) then 0
                        end as cancel_day_num
                from (select * 
                    from ptr_job_schedule
                    where ptr_job_id = {ptr_job_id}) pjs1
                left join (select `order` +1 as nxt_order, s_date s_date_nxt, e_date e_date_nxt from ptr_job_schedule where ptr_job_id = {ptr_job_id}) pjs2 on pjs1.`order` = pjs2.nxt_order
                left join (select id, job_start_date, job_end_date, job_cancel_at, status from ptr_job where job_type = 'donghaeng' and id ={ptr_job_id}) pj on pjs1.ptr_job_id = pj.id
                    
            ) work_sch
        ) cancel_time_tbl on cancel_fee_tbl.ptr_job_id = cancel_time_tbl.ptr_job_id
        
        ## 수수료 (동행 제외: 동행은 서비스가 진행되어야 cgs_payment에 기록)
        left join (select ptr_job_id, max(fee_company) / max(amount+fee_insurance+fee_company) cgs_fee_company_rate from cgs_payment where ptr_job_id ={ptr_job_id} group by ptr_job_id) as cgs_fcr
            on cancel_fee_tbl.ptr_job_id = cgs_fcr.ptr_job_id
        ## 첫 결제 금액
        join (select ptr_job_id, amount as fst_pay_amount from ptr_payment where status = 2 and deleted_at is null and ptr_job_id = {ptr_job_id}) pp on cancel_fee_tbl.ptr_job_id = pp.ptr_job_id
        

    ) calculator
    ;"""

    df1 = pd.read_sql_query(qry2, engine)

    df1.loc[0, ['위약금_선택', '총결제금액','취소금액','위약금','총취소금액' ]] = df1.loc[0, ['위약금_선택', '총결제금액','취소금액','위약금','총취소금액' ]].apply('{:,}'.format)
    df1.loc[0, df1.columns[11:]] = df1.loc[0, df1.columns[11:]].apply('{:,}'.format)


    d = json.loads(df1.to_json(orient='records'))

    return d

    
@app.route("/table/<int:id>/<string:cancel>", methods=['GET'])
def get_table(id, cancel):       

    ptr_job_id = id;  	
    job_cancel_at = cancel;			# 취소 요청 반영 근무 종료일
    
    #케어메이트 지급상태
    qry = f"""select *
    from (
        select {ptr_job_id} as ptr_job_id, seq, s_date
            , case when after_24_hours < '{job_cancel_at}' then e_date else '{job_cancel_at}' end as e_date
            , pay_status
            , new_payment_at
            , case 
                when s_date = if(after_24_hours < '{job_cancel_at}', after_24_hours, '{job_cancel_at}') then 0
                when job_type = 'day' 
                    then ceil(if((work_hr * 6 * unit_amount/24/6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount/24/6 %% 1 < 0.000001)
                                , round(work_hr * 6 * unit_amount / 24 / 6), work_hr * 6 * unit_amount /24 / 6))				
                        - floor(ceil(if((work_hr * 6 * unit_amount/24/6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount/24/6 %% 1 < 0.000001)
                                , round(work_hr * 6 * unit_amount / 24 / 6), work_hr * 6 * unit_amount /24 / 6)) * fee_company_rate)
                        - (if(is_ins = 1, if(job_type in ('day', 'term'), 350, 980), 0) * ins_days)
                    else ceil(if((work_hr * 6 * unit_amount / 6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount / 6 %% 1 < 0.000001)
                            , round(work_hr * 6 * unit_amount / 6), work_hr * 6 * unit_amount / 6))
                        - floor(ceil(if((work_hr * 6 * unit_amount / 6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount / 6 %% 1 < 0.000001)
                            , round(work_hr * 6 * unit_amount / 6), work_hr * 6 * unit_amount / 6)) * fee_company_rate)
                        - (if(is_ins = 1, if(job_type in ('day', 'term'), 350, 980), 0) * ins_days)
                    end as amount
            , if(is_ins = 1, if(job_type in ('day', 'term'), 350, 980), 0) * ins_days as ins
            , case 
                when s_date = if(after_24_hours < '{job_cancel_at}', after_24_hours, '{job_cancel_at}') then 0
                when job_type = 'day' 
                    then floor(ceil(if( (work_hr * 6 * unit_amount/24/6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount/24/6 %% 1 < 0.000001)
                            , round(work_hr * 6 * unit_amount / 24 / 6), work_hr * 6 * unit_amount /24 / 6)) * fee_company_rate)
                    else floor(ceil(if((work_hr * 6 * unit_amount / 6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount / 6 %% 1 < 0.000001)
                            , round(work_hr * 6 * unit_amount / 6), work_hr * 6 * unit_amount / 6)) * fee_company_rate)
                    end as fee_company
            , case 
                when job_type = 'day' 
                    then ceil(if((work_hr * 6 * unit_amount/24/6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount/24/6 %% 1 < 0.000001)
                        , round(work_hr * 6 * unit_amount / 24 / 6), work_hr * 6 * unit_amount /24 / 6))	
                    else ceil(if((work_hr * 6 * unit_amount / 6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount / 6 %% 1 < 0.000001)
                        , round(work_hr * 6 * unit_amount / 6), work_hr * 6 * unit_amount / 6))
                    end as total
            , 'payment' as payment_type

        from (
            select seq, s_date, e_date, after_24_hours, '{job_cancel_at}', sch_payment_at, sch_amount, sch_insurance, sch_fee_company, sch_total_amount, pay_status, new_payment_at
                , case when job_type = 'day' and after_24_hours <'{job_cancel_at}' then 24 
                    when job_type != 'day' and e_date < '{job_cancel_at}' then timestampdiff(hour, s_date, e_date)
                    else timestampdiff(hour, s_date, '{job_cancel_at}') 
                    end as work_hr
                , if(job_type = 'day', daily_amount, amount_time) as unit_amount
                , is_ins, ins_days
                , job_type
                , (select max(fee_company) / max(amount+fee_insurance+fee_company) from cgs_payment where ptr_job_id ={ptr_job_id} group by ptr_job_id) as fee_company_rate
                
            ###### 근무 및 지급 일정 테이블 ######
            from (
                select 
                    seq, s_date, e_date, after_24_hours, new_payment_at
                    , case 
                        when seq = 1 and date(s_date) != date(e_date) then 2
                        when seq = 1 and date(s_date) = date(e_date) then 1
                        when seq > 1 and date(s_date) != date(e_date) then 1
                        when seq > 1 and date(s_date) = date(e_date) then 0
                    end as ins_days
                from (
                    select seq, s_date
                        , if(date_add(s_date, interval 1 day) <= '{job_cancel_at}', date_add(s_date, interval 1 day), '{job_cancel_at}') as e_date
                        , date_add(s_date, interval 1 day) as after_24_hours
                        , if(job_type = 'donghaeng', date_format(date_add(s_date, interval 1 day), '%%Y-%%m-%%d 14:00:00'), 
                            if(date_add(s_date, interval 1 day) <= '{job_cancel_at}', date_add(s_date, interval 1 day), '{job_cancel_at}')) as new_payment_at
                    from (
                        select
                            seq
                            , date_add((select job_start_date from ptr_job where id={ptr_job_id}), interval seq - 1 day) as s_date
                            , (select job_start_date from ptr_job where id={ptr_job_id}) as job_start_date
                            , (select job_type from ptr_job where id={ptr_job_id}) as job_type
                        from (
                            select @num := @num + 1  as seq
                                , (select job_type from ptr_job where id={ptr_job_id}) as job_type
                            from 
                                information_schema.tables a
                                , (select @num := 0) b
                        ) T
                        
                        where 1=1
                            and seq <= datediff(date('{job_cancel_at}'), date((select job_start_date from ptr_job where id={ptr_job_id}))) + 1
                            and job_type = 'day'
                    ) A
                    where (s_date <'{job_cancel_at}') | (seq = 1)
                ) day_time_schedule

                union all
                
                select seq, s_date, e_date, after_24_hours, new_payment_at
                    , case 
                        when date(s_date) != date(e_date) and s_date_bf is null then 2
                        when date(s_date) != date(e_date) and date(s_date) = date(e_date_bf) then 1
                        when date(s_date) != date(e_date) and date(s_date) != date(e_date_bf) then 2
                        when date(s_date) = date(e_date) and s_date_bf is null then 1
                        when date(s_date) = date(e_date) and date(s_date) = date(e_date_bf) then 0
                        when date(s_date) = date(e_date) and date(s_date) != date(e_date_bf) then 1
                    end as ins_days
                from (
                    select `order` seq, s_date
                        , if(e_date <= '{job_cancel_at}', e_date, '{job_cancel_at}') e_date
                        , date_add(s_date, interval 1 day) as after_24_hours
                        , if(e_date <= '{job_cancel_at}', date_add(s_date, interval 1 day),'{job_cancel_at}') new_payment_at
                        , s_date_bf, e_date_bf
                        , '{job_cancel_at}'
                    from ptr_job_schedule
                        left join (
                            select `order` +1 seq_nxt, s_date s_date_bf, e_date e_date_bf
                            from ptr_job_schedule
                            where ptr_job_id = {ptr_job_id}
                            ) pjs2 on ptr_job_schedule.`order` = pjs2.seq_nxt
                    
                    where ptr_job_id = {ptr_job_id}
                        and (s_date < '{job_cancel_at}' or `order` = 1)
                        and job_type != 'day'
                    ) nday_time_schedule
            ) tsch_tbl
            
            
            left join (
                select ptr_job_id, amount sch_amount, fee_insurance sch_insurance, fee_company sch_fee_company, amount + fee_insurance + fee_company as sch_total_amount
                    , start_at as sch_start_at, end_at as sch_end_at, payment_at as sch_payment_at, status pay_status
                from cgs_payment
                where ptr_job_id = {ptr_job_id}
                    and (status = 'payment' and end_at <= '{job_cancel_at}')
            ) cp1 on tsch_tbl.s_date = cp1.sch_start_at
            
            ###### 1일 기준 지급 예정 금액(기간제) 및 수수료 ######
            left join (
                select ptr_job_id, max(amount + fee_insurance + fee_company) as daily_amount
                from cgs_payment
                where ptr_job_id = {ptr_job_id}
                    and (select job_type from ptr_job where id = {ptr_job_id}) = 'day'
                group by ptr_job_id
            ) day_cp on cp1.ptr_job_id = day_cp.ptr_job_id
            
            
            left join (
                select id as ptr_job_id, pja.amount_time
                from ptr_job
                    join (select ptr_job_id, amount_time from ptr_job_applicant where status = 'choice' and deleted_at is null) pja on ptr_job.id = pja.ptr_job_id
                where job_type != 'day'
                    and ptr_job.id = {ptr_job_id}
            ) nday_cp on cp1.ptr_job_id = nday_cp.ptr_job_id
            
            #
            join (select id as ptr_job_id, job_type, if(is_family='Y', 0, 1) is_ins from ptr_job where id = {ptr_job_id}) job_type on cp1.ptr_job_id = job_type.ptr_job_id
        ) A
        ) B
        where total != 0
        order by seq
        ;"""

    df = pd.read_sql_query(qry, engine)
    df = df[['new_payment_at', 'amount','ins','fee_company']]
    df.loc[len(df), : ]= df.loc[0:1, ['amount','ins','fee_company']].sum(axis=0)
    df.loc[len(df)-1, 'new_payment_at'] = '합계'

    d = json.loads(df.to_json(orient='records'))
        
    return d


@app.route("/table1/<int:id>/<string:cancel>", methods=['GET'])
def get_table1(id, cancel):      
    
    ptr_job_id = id	
    job_cancel_at = cancel	# 취소 요청 반영 근무 종료일
    
    #케어메이트 지급상태
    qry2 = f"""select *
    from (
        select {ptr_job_id} as ptr_job_id, seq, s_date
            , case when after_24_hours < '{job_cancel_at}' then e_date else '{job_cancel_at}' end as e_date
            , 'stay' as pay_status
            , new_payment_at
            , case 
                when s_date = if(after_24_hours < '{job_cancel_at}', after_24_hours, '{job_cancel_at}') then 0
                when job_type = 'day' 
                    then ceil(if((work_hr * 6 * unit_amount/24/6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount/24/6 %% 1 < 0.000001)
                                , round(work_hr * 6 * unit_amount / 24 / 6), work_hr * 6 * unit_amount /24 / 6))				
                        - floor(ceil(if((work_hr * 6 * unit_amount/24/6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount/24/6 %% 1 < 0.000001)
                                , round(work_hr * 6 * unit_amount / 24 / 6), work_hr * 6 * unit_amount /24 / 6)) * fee_company_rate)
                        - (if(is_ins = 1, if(job_type in ('day', 'term'), 350, 980), 0) * ins_days)
                    else ceil(if((work_hr * 6 * unit_amount / 6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount / 6 %% 1 < 0.000001)
                            , round(work_hr * 6 * unit_amount / 6), work_hr * 6 * unit_amount / 6))
                        - floor(ceil(if((work_hr * 6 * unit_amount / 6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount / 6 %% 1 < 0.000001)
                            , round(work_hr * 6 * unit_amount / 6), work_hr * 6 * unit_amount / 6)) * fee_company_rate)
                        - (if(is_ins = 1, if(job_type in ('day', 'term'), 350, 980), 0) * ins_days)
                    end as amount
            , if(is_ins = 1, if(job_type in ('day', 'term'), 350, 980), 0) * ins_days as ins
            , case 
                when s_date = if(after_24_hours < '{job_cancel_at}', after_24_hours, '{job_cancel_at}') then 0
                when job_type = 'day' 
                    then floor(ceil(if( (work_hr * 6 * unit_amount/24/6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount/24/6 %% 1 < 0.000001)
                            , round(work_hr * 6 * unit_amount / 24 / 6), work_hr * 6 * unit_amount /24 / 6)) * fee_company_rate)
                    else floor(ceil(if((work_hr * 6 * unit_amount / 6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount / 6 %% 1 < 0.000001)
                            , round(work_hr * 6 * unit_amount / 6), work_hr * 6 * unit_amount / 6)) * fee_company_rate)
                    end as fee_company
            , case 
                when job_type = 'day' 
                    then ceil(if((work_hr * 6 * unit_amount/24/6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount/24/6 %% 1 < 0.000001)
                        , round(work_hr * 6 * unit_amount / 24 / 6), work_hr * 6 * unit_amount /24 / 6))	
                    else ceil(if((work_hr * 6 * unit_amount / 6 %% 1 > 0.999999) | (work_hr * 6 * unit_amount / 6 %% 1 < 0.000001)
                        , round(work_hr * 6 * unit_amount / 6), work_hr * 6 * unit_amount / 6))
                    end as total
            , 'stay' as payment_type

        from (
            select seq, s_date, e_date, after_24_hours, '{job_cancel_at}', sch_payment_at, sch_amount, sch_insurance, sch_fee_company, sch_total_amount, pay_status, new_payment_at
                , case when job_type = 'day' and after_24_hours < '{job_cancel_at}' then 24 
                    when job_type != 'day' and e_date < '{job_cancel_at}' then timestampdiff(hour, s_date, e_date)
                    else timestampdiff(hour, s_date, '{job_cancel_at}') 
                    end as work_hr
                , if(job_type = 'day', daily_amount, amount_time) as unit_amount
                , is_ins, ins_days
                , job_type
                , (select max(fee_company) / max(amount+fee_insurance+fee_company) from cgs_payment where ptr_job_id = {ptr_job_id} group by ptr_job_id) as fee_company_rate
                
            from (
                select 
                    seq, s_date, e_date, after_24_hours, new_payment_at
                    , case 
                        when seq = 1 and date(s_date) != date(e_date) then 2
                        when seq = 1 and date(s_date) = date(e_date) then 1
                        when seq > 1 and date(s_date) != date(e_date) then 1
                        when seq > 1 and date(s_date) = date(e_date) then 0
                    end as ins_days
                from (
                    select seq, s_date
                        , if(date_add(s_date, interval 1 day) <= '{job_cancel_at}', date_add(s_date, interval 1 day), '{job_cancel_at}') as e_date
                        , date_add(s_date, interval 1 day) as after_24_hours
                        , if(job_type = 'donghaeng', date_format(date_add(s_date, interval 1 day), '%%Y-%%m-%%d 14:00:00'), 
                            if(date_add(s_date, interval 1 day) <= '{job_cancel_at}', date_add(s_date, interval 1 day), '{job_cancel_at}')) as new_payment_at
                    from (
                        select
                            seq
                            , date_add((select job_start_date from ptr_job where id={ptr_job_id}), interval seq - 1 day) as s_date
                            , (select job_start_date from ptr_job where id={ptr_job_id}) as job_start_date
                            , (select job_type from ptr_job where id={ptr_job_id}) as job_type
                        from (
                            select @num := @num + 1  as seq
                                , (select job_type from ptr_job where id={ptr_job_id}) as job_type
                            from 
                                information_schema.tables a
                                , (select @num := 0) b
                        ) T
                        
                        where 1=1
                            and seq <= datediff(date('{job_cancel_at}'), date((select job_start_date from ptr_job where id={ptr_job_id}))) + 1
                            and job_type = 'day'
                    ) A
                    where (s_date < '{job_cancel_at}') | (seq = 1)
                ) day_time_schedule

                union all
                
                select seq, s_date, e_date, after_24_hours, new_payment_at
                    , case 
                        when date(s_date) != date(e_date) and s_date_bf is null then 2
                        when date(s_date) != date(e_date) and date(s_date) = date(e_date_bf) then 1
                        when date(s_date) != date(e_date) and date(s_date) != date(e_date_bf) then 2
                        when date(s_date) = date(e_date) and s_date_bf is null then 1
                        when date(s_date) = date(e_date) and date(s_date) = date(e_date_bf) then 0
                        when date(s_date) = date(e_date) and date(s_date) != date(e_date_bf) then 1
                    end as ins_days
                from (
                    select `order` seq, s_date
                        , if(e_date <= '{job_cancel_at}', e_date, '{job_cancel_at}') e_date
                        , date_add(s_date, interval 1 day) as after_24_hours
                        , if(e_date <= '{job_cancel_at}', date_add(s_date, interval 1 day), '{job_cancel_at}') new_payment_at
                        , s_date_bf, e_date_bf
                        , '{job_cancel_at}'
                    from ptr_job_schedule
                        left join (
                            select `order` +1 seq_nxt, s_date s_date_bf, e_date e_date_bf
                            from ptr_job_schedule
                            where ptr_job_id = {ptr_job_id}
                            ) pjs2 on ptr_job_schedule.`order` = pjs2.seq_nxt
                    
                    where ptr_job_id = {ptr_job_id}
                        and (s_date < '{job_cancel_at}' or `order` = 1)
                        and job_type != 'day'
                    ) nday_time_schedule
            ) tsch_tbl
            
            left join (
                select ptr_job_id, amount sch_amount, fee_insurance sch_insurance, fee_company sch_fee_company, amount + fee_insurance + fee_company as sch_total_amount
                    , start_at as sch_start_at, end_at as sch_end_at, payment_at as sch_payment_at, status pay_status
                from cgs_payment
                where ptr_job_id = {ptr_job_id}
                    and ((status != 'payment') | (status = 'payment' and end_at > '{job_cancel_at}'))
            ) cp1 on tsch_tbl.s_date = cp1.sch_start_at 
            
            left join (
                select ptr_job_id, max(amount + fee_insurance + fee_company) as daily_amount
                from cgs_payment
                where ptr_job_id = {ptr_job_id}
                    and (select job_type from ptr_job where id = {ptr_job_id}) = 'day'
                group by ptr_job_id
            ) day_cp on cp1.ptr_job_id = day_cp.ptr_job_id
            
            left join (
                select id as ptr_job_id, pja.amount_time
                from ptr_job
                    join (select ptr_job_id, amount_time from ptr_job_applicant where status = 'choice' and deleted_at is null) pja on ptr_job.id = pja.ptr_job_id
                where job_type != 'day'
                    and ptr_job.id = {ptr_job_id}
            ) nday_cp on cp1.ptr_job_id = nday_cp.ptr_job_id
            
            join (select id as ptr_job_id, job_type, if(is_family='Y', 0, 1) is_ins from ptr_job where id = {ptr_job_id}) job_type on cp1.ptr_job_id = job_type.ptr_job_id
        ) A
    ) B
    where total != 0
    order by seq
    ;"""

    df1 = pd.read_sql_query(qry2, engine)
    df1 = df1[['new_payment_at', 'amount','ins','fee_company']]
    df1.loc[len(df1), : ]= df1.loc[0:1, ['amount','ins','fee_company']].sum(axis=0)
    df1.loc[len(df1)-1, 'new_payment_at'] = '합계'

    d = json.loads(df1.to_json(orient='records'))
        
    return d


@app.route("/table2/<int:id>/<string:cancel>/<int:penalty>", methods=['GET'])
def get_table2(id, cancel, penalty):      


    ptr_job_id = id  		
    job_cancel_at = cancel
    penalty_amount = penalty		# 취소 요청 반영 근무 종료일
                        # 취소 요청 공고 번호  		# 392705

    #케어메이트 지급상태
    qry3 = f"""select {ptr_job_id} as ptr_job_id, seq + 1 as seq, s_date, e_date
        , 'stay' pay_status
        , new_payment_at
        , ({penalty_amount} * 0.7)  as amount
        , 0 as ins
        , ({penalty_amount} * 0.3) - floor({penalty_amount} * 0.024) - floor(floor({penalty_amount} * 0.024) * 0.1) as fee_company
        , {penalty_amount} - floor({penalty_amount} * 0.024) - floor(floor({penalty_amount} * 0.024) * 0.1) as total
        , 'penalty' as payment_type	
    from (
        select 
            {ptr_job_id} ptr_job_id, seq, s_date, e_date, after_24_hours, new_payment_at
            , case 
                when seq = 1 and date(s_date) != date(e_date) then 2
                when seq = 1 and date(s_date) = date(e_date) then 1
                when seq > 1 and date(s_date) != date(e_date) then 1
                when seq > 1 and date(s_date) = date(e_date) then 0
            end as ins_days
        from (
            select seq, s_date
                , if(date_add(s_date, interval 1 day) <= '{job_cancel_at}', date_add(s_date, interval 1 day), '{job_cancel_at}') as e_date
                , date_add(s_date, interval 1 day) as after_24_hours
                , if(date_add(s_date, interval 1 day) <= '{job_cancel_at}', date_add(s_date, interval 1 day), '{job_cancel_at}') as new_payment_at
            from (
                select
                    seq
                    , date_add((select job_start_date from ptr_job where id={ptr_job_id}), interval seq - 1 day) as s_date
                    , (select job_start_date from ptr_job where id={ptr_job_id}) as job_start_date
                    
                from (
                    select @num := @num + 1  as seq
                        , (select job_type from ptr_job where id={ptr_job_id}) as job_type
                    from 
                        information_schema.tables a
                        , (select @num := 0) b
                ) T
                
                where 1=1
                    and seq <= datediff(date('{job_cancel_at}'), date((select job_start_date from ptr_job where id={ptr_job_id}))) + 1
                    and job_type = 'day'
            ) A
            where (s_date < '{job_cancel_at}') | (seq = 1)
        ) day_time_schedule

        union all
        
        select {ptr_job_id} as ptr_job_id, seq, s_date, e_date, after_24_hours, new_payment_at
            , case 
                when date(s_date) != date(e_date) and s_date_bf is null then 2
                when date(s_date) != date(e_date) and date(s_date) = date(e_date_bf) then 1
                when date(s_date) = date(e_date) and s_date_bf is null then 1
                when date(s_date) = date(e_date) and date(s_date) = date(e_date_bf) then 0
                when date(s_date) = date(e_date) and date(s_date) != date(e_date_bf) then 1
            end as ins_days
        from (
            select 
                `order` seq, s_date
                , if(e_date <= '{job_cancel_at}', e_date, '{job_cancel_at}') e_date
                , date_add(s_date, interval 1 day) as after_24_hours
                , if(e_date <=  '{job_cancel_at}', date_add(s_date, interval 1 day), '{job_cancel_at}') new_payment_at
                , s_date_bf, e_date_bf
            from ptr_job_schedule
                left join (
                    select `order` +1 seq_nxt, s_date s_date_bf, e_date e_date_bf
                    from ptr_job_schedule
                    where ptr_job_id = {ptr_job_id}
                    ) pjs2 on ptr_job_schedule.`order` = pjs2.seq_nxt
            
            where ptr_job_id = {ptr_job_id}
                and (s_date < '{job_cancel_at}' or `order` = 1)
                and job_type != 'day'
            ) nday_time_schedule
        order by seq desc
        limit 1
    ) tsch_tbl
    where {penalty_amount} != 0
    ;
    """

    df2 = pd.read_sql_query(qry3, engine)

    d = json.loads(df2.to_json(orient='records'))

        
    return d


if __name__ == '__main__':

    app.run(host='0.0.0.0', debug=False)
    