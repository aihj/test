import * as React from 'react';
import dayjs from 'dayjs';
import { DemoContainer } from '@mui/x-date-pickers/internals/demo';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import { useState, useEffect } from 'react';
import io from "socket.io-client";
import "./App.css";
import {format}from 'date-fns';
import Select, { components }  from "react-select";

/*표*/
import { AgGridReact} from 'ag-grid-react'; // React Data Grid Component
import "ag-grid-community/styles/ag-grid.css"; // Mandatory CSS required by the Data Grid
import 'ag-grid-community/styles/ag-theme-alpine.css';

import axios from "axios";

const options = [
  { value: '없음', label: '없음' },
  { value: '10,000원', label: '10,000원' },
  { value: '20,000원', label: '20,000원' },
  { value: '30,000원', label: '30,000원' },
  ]

export default function App() {



  const[out,setOut]= useState([]);


  const[out2,setOut2]= useState([{label: '총 시간', 값: "", label2: '총 케어메이트 비용', 값2: '100,000원'},
    {label: '시작 일시' , label2: ' ↳ 서비스 비용'},
    {label: '종료 일시' , label2: ' ↳ 위약금'},
    {label: '결제 금액' , label2: '케어메이트 수수료'},
    {label: ' ↳ 서비스 금액', label2: ' ↳ 서비스 수수료' },
    {label: ' ↳ 위약금', label2: ' ↳ 위약금 수수료'  },
    {label: 'PG 수수료' ,label2: '보험료' },
    {label: 'PG사 입금 금액' ,label2: '케어메이트 총 급여' },
    {label: '신청인 수수료' }]);

  const[status, setStatus] = useState(false);
  const[cancel,setCancel] = useState(1);
  const[penalty, setPenalty] = useState([{value: "", label:""}]);


  const [time, setTime] = React.useState(dayjs('2024-11-04 01:00'));
  const [time1, setTime1] = React.useState(dayjs('2024-11-02 08:00'));

  const[id, setId] = React.useState(0);
  const[row, setRow] = useState([])
  const[row1, setRow1] = useState([])
  const[row2, setRow2] = useState([])
  const[row3, setRow3] = useState([])


  const colDefs =  [{headerName: "취소후 예상 정산 정보",
                                            children: [{field: "label", width: 150, cellStyle: {'background-color': '#dee5ee'}
                                            }, {field: "값", width: 180},
                                              {field: "label2", width: 150, cellStyle: {'background-color': '#dee5ee'}},
                                              {field:"값2", width:180} ]}]

  const colDefs1 =  [{headerName: "케어메이트 지급 상태",
                                            children: [{field: "입금일시", width: 150, cellStyle: {'background-color': '#dee5ee'}
                                            }, {field: "처리금액(일 서비스료)", width: 180},
                                              {field: "일 보험료", width: 150, cellStyle: {'background-color': '#dee5ee'}},
                                              {field:"일 수수료", width:180} ]}]
                              
  const colDefs2 =  [{headerName: "취소 후 지급 예정(서비스)",
                                               children: [{field: "입금일시", width: 150, cellStyle: {'background-color': '#dee5ee'}
                                            }, {field: "처리금액(일 서비스료)", width: 180},
                                              {field: "일 보험료", width: 150, cellStyle: {'background-color': '#dee5ee'}},
                                              {field:"일 수수료", width:180} ]}]
                              

  const colDefs3 =  [{headerName: "취소 후 지급 예정(위약금)",
                                            children: [{field: "입금일시", width: 150, cellStyle: {'background-color': '#dee5ee'}
                                            }, {field: "처리금액(지급액)", width: 180},
                                              {field: "일 보험료", width: 150, cellStyle: {'background-color': '#dee5ee'}},
                                              {field:"일 수수료(PG 수수료 미포함)", width:180} ]}]

  useEffect(() => {

    setRow([{label: '총 시간', 값:out2.종료예상정보_총시간1_시간+"시간"+ out2.종료예상정보_총시간1_분+"분"+ " (" + out2.종료예상정보_총시간2_일+ "일"+ out2.종료예상정보_총시간2_시간+"시간"+")"
      ,label2: '총 케어메이트 비용', 값2: out2.종료예상정보_총케어메이트비용 + ' 원'},
      {label: '시작 일시' ,값: out.공고시작일,  label2: ' ↳ 서비스 비용', 값2: out2.종료예상정보_케어메이트비용서비스비용 + ' 원'},
      {label: '종료 일시' ,값: format(time1,'yyyy-MM-dd HH:mm:ss'), label2: ' ↳ 위약금',  값2: out2.종료예상정보_케어메이트위약금 + ' 원'},
      {label: '결제 금액' ,값: out2.종료예상정보_보호자총결제금액 +' 원', label2: '케어메이트 수수료', 값2: out2.종료예상정보_총케어메이트수수료 + ' 원'},
      {label: ' ↳ 서비스 금액',값: out2.종료예상정보_서비스결제금액+' 원' , label2: ' ↳ 서비스 수수료', 값2: out2.종료예상정보_케어메이트서비스수수료 + ' 원' },
      {label: ' ↳ 위약금',값: out2.종료예상정보_위약금총액+' 원', label2: ' ↳ 위약금 수수료', 값2: out2.종료예상정보_케어메이트위약금수수료 + ' 원'  },
      {label: 'PG 수수료' ,값: out2.종료예상정보_pg수수료+' 원', label2: '보험료' ,값2: out2.종료예상정보_보험료 + ' 원' },
      {label: 'PG사 입금 금액' ,값: out2.종료예상정보_pg사입금금액+' 원', label2: '케어메이트 총 급여', 값2: out2.종료예상정보_케어메이트총급여 + ' 원'},
      {label: '신청인 수수료' ,값: out2.종료예상정보_신청인수수료+' 원' }] )
    
      setRow1([{입금일시: '', "처리금액(일 서비스료)": '', "일 보험료": '', "일 수수료": ''}       
      ] )

      setRow2([{입금일시: '', "처리금액(일 서비스료)": '', "일 보험료": '', "일 수수료": ''}       
      ] )

      setRow3([{입금일시: '', "처리금액(지급료)": '', "일 보험료": '', "일 수수료(PG 수수료 미포함)": ''}       
      ] )


    
    }, [out2]);

      



  const handleChange = e => {
    setId(e.target.value);
  }

  const handleSubmit = e => {

    const ptr_job_id = id;

    const cancel_request_at = format(time,'yyyy-MM-dd HH:mm:ss');
    const job_cancel_at = format(time1,'yyyy-MM-dd HH:mm:ss');

    // const url = `http://192.168.0.89:5000/info/${ptr_job_id}/${cancel_request_at}/${job_cancel_at}`
    const url = `${process.env.REACT_APP_PROXY}api/`;
        

    fetch(url)
    .then((response) => {console.log(response);})//
    // .then((json)=> setOut(json[0]));

  }

  const handleSubmit1 = e => {

    const ptr_job_id = id;

    const job_cancel_at = format(time1,'yyyy-MM-dd HH:mm:ss');
    
    const cancel_request_at = format(time,'yyyy-MM-dd HH:mm:ss');

    const penalty_amount = out.예상위약금.replace(',', '');
    console.log(penalty_amount);

    const url1 = `http://192.168.0.89:5000/price/${ptr_job_id}/${cancel_request_at}/${penalty_amount}`;

    fetch(url1)//json파일 읽어오기
    .then((response) => response.json())//
    .then((json)=> setOut2(json[0]));
  
  
  }


  useEffect(()=> {
    if(out.서비스유형 ==='day' || out.서비스유형 ==='time' || out.서비스유형 ==='term'){
      out.서비스유형 = '간병';
      } else if (out.서비스유형 === 'donghaeng'){out.서비스유형 = '동행'}
      else if (out.서비스유형 === 'housekeeper'){out.서비스유형 = '가사돌봄'}
      else if (out.서비스유형 === 'birthcare-day' || out.서비스유형 === 'birthcare-term'){out.서비스유형 ='산후돌봄'
      }
    
    
    setPenalty([{value: out.예상위약금 +"원", label:out.예상위약금 + "원"}]);} , [out]);

  

  const radioHandler = (cancel) => {
    setCancel(cancel);
  };

  const handleClear = () => {
    setTime(dayjs(''));
  }


  const customTheme = (theme) => ({
    ...theme,
    borderRadius: 0,
    colors: {
        ...theme.colors,
        primary25: 'lightblue', // change Background color of options on hover
        primary: 'darkblue', // change the Background color of the selected option
    },
    });

    const Menu = props => {
      const optionSelectedLength = props.getValue().length || 0;
      return (
        <components.Menu {...props}>
          {optionSelectedLength < 5 ? (
            props.children
          ) : (
            <div> 최대 5개 선택 가능 </div>
          )}
        </components.Menu>
      );
    };

  return (

      <>


        <section className="text-gray-600 body-font">
          <div className="container px-5 py-5 mx-auto">
            <h1 className="text-3xl font-medium title-font text-gray-900 mb-12 text-center"></h1>
            <div className="flex flex-wrap -m-4">
              <div className="p-4 md:w-1/2 w-full">
                <div className="h-full bg-gray-100 p-8 rounded">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor"
                       className="block w-5 h-5 text-gray-400 mb-4" viewBox="0 0 975.036 975.036">
                    <path
                        d="M925.036 57.197h-304c-27.6 0-50 22.4-50 50v304c0 27.601 22.4 50 50 50h145.5c-1.9 79.601-20.4 143.3-55.4 191.2-27.6 37.8-69.399 69.1-125.3 93.8-25.7 11.3-36.8 41.7-24.8 67.101l36 76c11.6 24.399 40.3 35.1 65.1 24.399 66.2-28.6 122.101-64.8 167.7-108.8 55.601-53.7 93.7-114.3 114.3-181.9 20.601-67.6 30.9-159.8 30.9-276.8v-239c0-27.599-22.401-50-50-50zM106.036 913.497c65.4-28.5 121-64.699 166.9-108.6 56.1-53.7 94.4-114.1 115-181.2 20.6-67.1 30.899-159.6 30.899-277.5v-239c0-27.6-22.399-50-50-50h-304c-27.6 0-50 22.4-50 50v304c0 27.601 22.4 50 50 50h145.5c-1.9 79.601-20.4 143.3-55.4 191.2-27.6 37.8-69.4 69.1-125.3 93.8-25.7 11.3-36.8 41.7-24.8 67.101l35.9 75.8c11.601 24.399 40.501 35.2 65.301 24.399z"></path>
                  </svg>
                  <p className="leading-relaxed mb-6">취소 정보 입력</p>
                  <div className="relative mb-4">
                    <label htmlFor="full-name" className="leading-7 text-sm text-gray-600">공고 번호</label>
                    <form onSubmit={handleSubmit}>
                      <input type="text"
                          // value={values.공고번호}
                             placeholder="419098"
                             onChange={handleChange}
                             className="w-full bg-white rounded border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"/>
                    </form>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                      <DemoContainer components={['DateTimePicker']}>
                        <br/>
                        <DateTimePicker
                            label="취소요청시간"
                            value={time}
                            onChange={(newValue) => {
                              setTime(newValue);
                              // setStatus(curr => ({...curr, b: true}));
                            }}
                            sx={{bgcolor: 'white'}}

                        />

                        <div className="radio" style={{textAlign: 'left'}}>


                          <input type="radio" name="release" checked={cancel === 1}
                                 onClick={(e) => radioHandler(1)}/> 전체취소&nbsp;

                          <input type="radio" name="release" checked={cancel === 2}
                                 onClick={(e) => radioHandler(2)}/> 부분취소&nbsp;

                        </div>

                        <DateTimePicker
                            label={cancel === 1 ? "시작시간(전체취소)" : "종료시간(부분취소)"}
                            value={time1}
                            onChange={(newValue) => {
                              setTime1(newValue);
                              // setStatus(curr => ({...curr, c: true}));

                            }}
                            sx={{bgcolor: 'white'}}
                        />
                      </DemoContainer>
                    </LocalizationProvider>
                    <div style={{display: 'flex', marginLeft: '430px', gap: '20px'}}>
                      <button onClick={handleSubmit}
                              className="flex  mt-8 text-white bg-blue-500 border-0 py-1.5 px-8 focus:outline-none hover:bg-blue-600 rounded text-md">확인
                      </button>
                      <button onClick={() => handleClear()}
                              className="flex  mt-8 text-white bg-blue-500 border-0 py-1.5 px-8 focus:outline-none hover:bg-blue-600 rounded text-md">초기화
                      </button>
                    </div>
                  </div>


                </div>
              </div>
              <div className="p-4 md:w-1/2 w-full">
                <div className="h-full bg-gray-100 p-8 rounded">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor"
                       className="block w-5 h-5 text-gray-400 mb-4" viewBox="0 0 975.036 975.036">
                    <path
                        d="M925.036 57.197h-304c-27.6 0-50 22.4-50 50v304c0 27.601 22.4 50 50 50h145.5c-1.9 79.601-20.4 143.3-55.4 191.2-27.6 37.8-69.399 69.1-125.3 93.8-25.7 11.3-36.8 41.7-24.8 67.101l36 76c11.6 24.399 40.3 35.1 65.1 24.399 66.2-28.6 122.101-64.8 167.7-108.8 55.601-53.7 93.7-114.3 114.3-181.9 20.601-67.6 30.9-159.8 30.9-276.8v-239c0-27.599-22.401-50-50-50zM106.036 913.497c65.4-28.5 121-64.699 166.9-108.6 56.1-53.7 94.4-114.1 115-181.2 20.6-67.1 30.899-159.6 30.899-277.5v-239c0-27.6-22.399-50-50-50h-304c-27.6 0-50 22.4-50 50v304c0 27.601 22.4 50 50 50h145.5c-1.9 79.601-20.4 143.3-55.4 191.2-27.6 37.8-69.4 69.1-125.3 93.8-25.7 11.3-36.8 41.7-24.8 67.101l35.9 75.8c11.601 24.399 40.501 35.2 65.301 24.399z"></path>
                  </svg>
                  <p className="leading-relaxed mb-6">공고 정보</p>
                  <div className="relative mb-4">
                    <label htmlFor="full-name" className="leading-7 text-sm text-gray-600">서비스 유형</label>

                    <input type="text"
                           placeholder={out ? out.서비스유형 : "서비스유형"}
                           className="w-full bg-slate-500 rounded border border-gray-300 focus:border-blue-500 focus:ring-2
                           focus:ring-blue-200 outline-none placeholder:text-white py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                           disabled/>
                    <br/>
                    <br/>

                    <label htmlFor="full-name" className="leading-7 text-sm text-gray-600">보호자(신청인)</label>
                    <input type="text"
                           placeholder={out ? out.보호자이름 : "보호자이름"}
                           className="w-full bg-slate-500 rounded border border-gray-300 focus:border-blue-500 focus:ring-2
                           focus:ring-blue-200 outline-none placeholder:text-white py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                           disabled/> <br/>
                    <br/>

                    <label htmlFor="full-name" className="leading-7 text-sm text-gray-600">케어메이트</label>

                    <input type="text"
                           placeholder={out ? out.케어메이트이름 : "케어메이트이름"}
                           className="w-full bg-slate-500 rounded border border-gray-300 focus:border-blue-500 focus:ring-2
                           focus:ring-blue-200 outline-none placeholder:text-white py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                           disabled/> <br/>
                    <br/>
                    <label htmlFor="full-name" className="leading-7 text-sm text-gray-600">공고시작일 ~ 공고종료일</label>
                    <br/>
                    <input type="text"
                           placeholder={out? out.공고시작일 : "공고시작일"}
                           className="w-1/3 bg-slate-400 rounded border border-gray-300 focus:border-blue-500 focus:ring-2
                           focus:ring-blue-200 outline-none placeholder:text-white py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                           disabled/>             &nbsp;~&nbsp;
                    <input type="text"
                           placeholder={out ? out.공고종료일 : "공고종료일"}
                           className="w-1/3 bg-slate-400 rounded border border-gray-300 focus:border-blue-500 focus:ring-2
                           focus:ring-blue-200 outline-none placeholder:text-white py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                           disabled/>

                  </div>


                </div>


              </div>

              <div className="p-4 md:w-1/2 w-full">
                <div className="h-full bg-gray-100 p-8 rounded">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor"
                       className="block w-5 h-5 text-gray-400 mb-4" viewBox="0 0 975.036 975.036">
                    <path
                        d="M925.036 57.197h-304c-27.6 0-50 22.4-50 50v304c0 27.601 22.4 50 50 50h145.5c-1.9 79.601-20.4 143.3-55.4 191.2-27.6 37.8-69.399 69.1-125.3 93.8-25.7 11.3-36.8 41.7-24.8 67.101l36 76c11.6 24.399 40.3 35.1 65.1 24.399 66.2-28.6 122.101-64.8 167.7-108.8 55.601-53.7 93.7-114.3 114.3-181.9 20.601-67.6 30.9-159.8 30.9-276.8v-239c0-27.599-22.401-50-50-50zM106.036 913.497c65.4-28.5 121-64.699 166.9-108.6 56.1-53.7 94.4-114.1 115-181.2 20.6-67.1 30.899-159.6 30.899-277.5v-239c0-27.6-22.399-50-50-50h-304c-27.6 0-50 22.4-50 50v304c0 27.601 22.4 50 50 50h145.5c-1.9 79.601-20.4 143.3-55.4 191.2-27.6 37.8-69.4 69.1-125.3 93.8-25.7 11.3-36.8 41.7-24.8 67.101l35.9 75.8c11.601 24.399 40.501 35.2 65.301 24.399z"></path>
                  </svg>
                  <p className="leading-relaxed mb-6">위약금 정보</p>
                  <div className="relative mb-4">
                    <label htmlFor="full-name" className="leading-7 text-sm text-gray-600">시간차</label>

                    <input type="text"
                           placeholder={out ? out.위약금시간차 : "위약금시간차"}
                           className="w-full bg-slate-500 rounded border border-gray-300 focus:border-blue-500 focus:ring-2
                        focus:ring-blue-200 outline-none placeholder:text-white py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                           disabled/> <br/>
                    <br/>


                    <label htmlFor="full-name" className="leading-7 text-sm text-gray-600">예상위약금</label>

                    <input type="text"
                           placeholder={out ? out.예상위약금 : "예상위약금"}
                           className="w-full bg-slate-500 rounded border border-gray-300 focus:border-blue-500 focus:ring-2
                          focus:ring-blue-200 outline-none placeholder:text-white py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                           disabled/> <br/>

                    <br/>


                    <label htmlFor="full-name" className="leading-7 text-sm text-gray-600">위약금</label>


                    <Select components={{Menu}}
                            options={options}
                            value={penalty}
                            theme={customTheme}
                            isClearable={true}/>


                    <div style={{display: 'flex', marginLeft: '430px', gap: '20px'}}>
                      <button onClick={() => handleSubmit1()}
                              className="flex  mt-8 text-white bg-blue-500 border-0 py-1.5 px-8 focus:outline-none hover:bg-blue-600 rounded text-mf">확인
                      </button>
                      <button onClick={() => setTime('')}
                              className="flex  mt-8 text-white bg-blue-500 border-0 py-1.5 px-8 focus:outline-none hover:bg-blue-600 rounded text-mf">초기화
                      </button>
                    </div>
                  </div>


                </div>
              </div>

              <div className="p-4 md:w-1/2 w-full">
                <div className="h-full bg-gray-100 p-8 rounded">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor"
                       className="block w-5 h-5 text-gray-400 mb-4" viewBox="0 0 975.036 975.036">
                    <path
                        d="M925.036 57.197h-304c-27.6 0-50 22.4-50 50v304c0 27.601 22.4 50 50 50h145.5c-1.9 79.601-20.4 143.3-55.4 191.2-27.6 37.8-69.399 69.1-125.3 93.8-25.7 11.3-36.8 41.7-24.8 67.101l36 76c11.6 24.399 40.3 35.1 65.1 24.399 66.2-28.6 122.101-64.8 167.7-108.8 55.601-53.7 93.7-114.3 114.3-181.9 20.601-67.6 30.9-159.8 30.9-276.8v-239c0-27.599-22.401-50-50-50zM106.036 913.497c65.4-28.5 121-64.699 166.9-108.6 56.1-53.7 94.4-114.1 115-181.2 20.6-67.1 30.899-159.6 30.899-277.5v-239c0-27.6-22.399-50-50-50h-304c-27.6 0-50 22.4-50 50v304c0 27.601 22.4 50 50 50h145.5c-1.9 79.601-20.4 143.3-55.4 191.2-27.6 37.8-69.4 69.1-125.3 93.8-25.7 11.3-36.8 41.7-24.8 67.101l35.9 75.8c11.601 24.399 40.501 35.2 65.301 24.399z"></path>
                  </svg>
                  <p className="leading-relaxed mb-6">보호자/신청인 취소 금액</p>
                  <div className="relative mb-4">
                    <label htmlFor="full-name" className="leading-7 text-sm text-gray-600">총 결제 금액</label>

                    <input type="text"
                           placeholder={out2 ? out2.총결제금액+ " 원" : "총결제금액"}
                           className="w-full bg-slate-500 rounded border border-gray-300 focus:border-blue-500 focus:ring-2
                          focus:ring-blue-200 outline-none placeholder:text-white py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                           disabled/> <br/>
                    <br/>
                    <label htmlFor="full-name" className="leading-7 text-sm text-gray-600">취소 유형</label>

                    <input type="text"
                           placeholder={out2 ? out2.취소유형 : "부분취소/전체취소"}
                           className="w-full bg-slate-500 rounded border border-gray-300 focus:border-blue-500 focus:ring-2
                          focus:ring-blue-200 outline-none placeholder:text-white py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                           disabled/> <br/>
                    <br/>

                    <label htmlFor="full-name" className="leading-7 text-sm text-gray-600">취소 금액</label>

                    <input type="text"
                           placeholder={out2 ? out2.취소금액 + " 원" : "취소금액"}
                           className="w-full bg-slate-500 rounded border border-gray-300 focus:border-blue-500 focus:ring-2
                          focus:ring-blue-200 outline-none placeholder:text-white py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                           disabled/> <br/>
                    <br/>
                    <label htmlFor="full-name" className="leading-7 text-sm text-gray-600">위약금</label>

                    <input type="text"
                           placeholder={out2 ? out2.위약금+ " 원" : "위약금"}
                           className="w-full bg-slate-500 rounded border border-gray-300 focus:border-blue-500 focus:ring-2
                          focus:ring-blue-200 outline-none placeholder:text-white py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                           disabled/> <br/>
                    <br/>
                    <label htmlFor="full-name" className="leading-7 text-sm text-gray-600">총 취소 금액</label>

                    <input type="text"
                           placeholder={out2 ? out2.총취소금액+ " 원" : "총취소금액"}
                           className="w-full bg-slate-500 rounded border border-gray-300 focus:border-blue-500 focus:ring-2
                          focus:ring-blue-200 outline-none placeholder:text-white py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                           disabled/> <br/>
                    <br/>

                  </div>

                </div>
              </div>

              <div className="p-4 md:w-1/2 w-full">
                <div className="h-full bg-gray-100 p-8 rounded">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor"
                       className="block w-5 h-5 text-gray-400 mb-4" viewBox="0 0 975.036 975.036">
                    <path
                        d="M925.036 57.197h-304c-27.6 0-50 22.4-50 50v304c0 27.601 22.4 50 50 50h145.5c-1.9 79.601-20.4 143.3-55.4 191.2-27.6 37.8-69.399 69.1-125.3 93.8-25.7 11.3-36.8 41.7-24.8 67.101l36 76c11.6 24.399 40.3 35.1 65.1 24.399 66.2-28.6 122.101-64.8 167.7-108.8 55.601-53.7 93.7-114.3 114.3-181.9 20.601-67.6 30.9-159.8 30.9-276.8v-239c0-27.599-22.401-50-50-50zM106.036 913.497c65.4-28.5 121-64.699 166.9-108.6 56.1-53.7 94.4-114.1 115-181.2 20.6-67.1 30.899-159.6 30.899-277.5v-239c0-27.6-22.399-50-50-50h-304c-27.6 0-50 22.4-50 50v304c0 27.601 22.4 50 50 50h145.5c-1.9 79.601-20.4 143.3-55.4 191.2-27.6 37.8-69.4 69.1-125.3 93.8-25.7 11.3-36.8 41.7-24.8 67.101l35.9 75.8c11.601 24.399 40.501 35.2 65.301 24.399z"></path>
                  </svg>
                  
                  <div className="relative mb-4">


                    <div className="ag-theme-alpine"
                         style={{width: 681, height: 440, textAlign: 'center'}}>


                      <AgGridReact
                          rowData={row1}
                          columnDefs={colDefs1}
                          groupHeaderHeight={40}
                          
                          rowHeight={40}>

                      </AgGridReact>
                    </div>


                  </div>

                </div>
              </div>


              <div className="p-4 md:w-1/2 w-full">
                <div className="h-full bg-gray-100 p-8 rounded">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor"
                       className="block w-5 h-5 text-gray-400 mb-4" viewBox="0 0 975.036 975.036">
                    <path
                        d="M925.036 57.197h-304c-27.6 0-50 22.4-50 50v304c0 27.601 22.4 50 50 50h145.5c-1.9 79.601-20.4 143.3-55.4 191.2-27.6 37.8-69.399 69.1-125.3 93.8-25.7 11.3-36.8 41.7-24.8 67.101l36 76c11.6 24.399 40.3 35.1 65.1 24.399 66.2-28.6 122.101-64.8 167.7-108.8 55.601-53.7 93.7-114.3 114.3-181.9 20.601-67.6 30.9-159.8 30.9-276.8v-239c0-27.599-22.401-50-50-50zM106.036 913.497c65.4-28.5 121-64.699 166.9-108.6 56.1-53.7 94.4-114.1 115-181.2 20.6-67.1 30.899-159.6 30.899-277.5v-239c0-27.6-22.399-50-50-50h-304c-27.6 0-50 22.4-50 50v304c0 27.601 22.4 50 50 50h145.5c-1.9 79.601-20.4 143.3-55.4 191.2-27.6 37.8-69.4 69.1-125.3 93.8-25.7 11.3-36.8 41.7-24.8 67.101l35.9 75.8c11.601 24.399 40.501 35.2 65.301 24.399z"></path>
                  </svg>
                  
                  <div className="relative mb-4">


                    <div className="ag-theme-alpine"
                         style={{width: 681, height: 200, textAlign: 'center'}}>


                      <AgGridReact
                          rowData={row2}
                          columnDefs={colDefs2}
                          groupHeaderHeight={40}
                          
                          rowHeight={40}>

                      </AgGridReact>

                      <br />

                      <AgGridReact
                          rowData={row2}
                          columnDefs={colDefs3}
                          groupHeaderHeight={40}
                          
                          rowHeight={40}>

                      </AgGridReact>
                    </div>


                  </div>

                </div>
              </div>



              <div className="p-4 md:w-1/2 w-full">
                <div className="h-full bg-gray-100 p-8 rounded">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor"
                       className="block w-5 h-5 text-gray-400 mb-4" viewBox="0 0 975.036 975.036">
                    <path
                        d="M925.036 57.197h-304c-27.6 0-50 22.4-50 50v304c0 27.601 22.4 50 50 50h145.5c-1.9 79.601-20.4 143.3-55.4 191.2-27.6 37.8-69.399 69.1-125.3 93.8-25.7 11.3-36.8 41.7-24.8 67.101l36 76c11.6 24.399 40.3 35.1 65.1 24.399 66.2-28.6 122.101-64.8 167.7-108.8 55.601-53.7 93.7-114.3 114.3-181.9 20.601-67.6 30.9-159.8 30.9-276.8v-239c0-27.599-22.401-50-50-50zM106.036 913.497c65.4-28.5 121-64.699 166.9-108.6 56.1-53.7 94.4-114.1 115-181.2 20.6-67.1 30.899-159.6 30.899-277.5v-239c0-27.6-22.399-50-50-50h-304c-27.6 0-50 22.4-50 50v304c0 27.601 22.4 50 50 50h145.5c-1.9 79.601-20.4 143.3-55.4 191.2-27.6 37.8-69.4 69.1-125.3 93.8-25.7 11.3-36.8 41.7-24.8 67.101l35.9 75.8c11.601 24.399 40.501 35.2 65.301 24.399z"></path>
                  </svg>
                  <p className="leading-relaxed mb-6">보호자 취소 금액 계산기 - 종료 예상 정보</p>
                  <div className="relative mb-4">


                    <div className="ag-theme-alpine"
                         style={{width: 685, height: 440, textAlign: 'center'}}>


                      <AgGridReact
                          rowData={row}
                          columnDefs={colDefs}
                          groupHeaderHeight={60}
                          headerHeight={0}
                          rowHeight={40}>

                      </AgGridReact>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className='App' style={{width: '30vh'}}>

          <br/>


          <br/>


        </div>

        <div>

          {status ? "true" : "false"}


        </div>

      </>
  );
}