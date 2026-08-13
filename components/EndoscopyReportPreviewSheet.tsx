import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2 } from 'lucide-react';
import { getEffectiveLogoBase64, getLogoUrlWithCacheBust, getLogoSettings, getVerificationUrl } from '../services/pdfService';
import { GastroScopeIcon } from './GastroScopeIcon';

export interface EndoscopyReportPreviewSheetProps {
  formName: string;
  formRegNo: string;
  formAge: string;
  formGender: string;
  formDate: string;
  formTime: string;
  formDoctor: string;
  formReferringPhysician: string;
  formProcedure: string;
  formMedications: string;
  formInstruments: string;
  formVisualization: string;
  formTolerance: string;
  formComplications: string;
  formIndications: string;
  formProcedureTechnique: string;
  formEsophagusFindings: string;
  formStomachFindings: string;
  formAntrumFindings: string;
  formDuodenumFindings: string;
  formDuodenum2ndPartFindings: string;
  formColonFindings: string;
  formFindings: string;
  formRectumFindings: string;
  formSigmoidColonFindings: string;
  formTransverseColonFindings: string;
  formDescendingColonFindings: string;
  formAscendingColonFindings: string;
  formCaecumFindings: string;
  formDiagnosis: string;
  formRecommendations: string;
  formImages: Array<{ id: string; url: string; title: string }>;
  isBronchoscopy: boolean;
  isColonoscopy: boolean;
  isCompactView: boolean;
  currentUser: { displayName?: string | null; email?: string | null } | null;
}

export const EndoscopyReportPreviewSheet: React.FC<EndoscopyReportPreviewSheetProps> = ({
  formName,
  formRegNo,
  formAge,
  formGender,
  formDate,
  formTime,
  formDoctor,
  formReferringPhysician,
  formProcedure,
  formMedications,
  formInstruments,
  formVisualization,
  formTolerance,
  formComplications,
  formIndications,
  formProcedureTechnique,
  formEsophagusFindings,
  formStomachFindings,
  formAntrumFindings,
  formDuodenumFindings,
  formDuodenum2ndPartFindings,
  formColonFindings,
  formFindings,
  formRectumFindings,
  formSigmoidColonFindings,
  formTransverseColonFindings,
  formDescendingColonFindings,
  formAscendingColonFindings,
  formCaecumFindings,
  formDiagnosis,
  formRecommendations,
  formImages,
  isBronchoscopy,
  isColonoscopy,
  isCompactView,
  currentUser,
}) => {
  return (
    <div
      className={`bg-white text-slate-800 shadow-2xl border border-slate-300 w-full max-w-4xl flex flex-col justify-between relative select-text transition-all duration-300 endoscopy-print-sheet rounded-xl my-auto ${
        isCompactView ? 'p-4 sm:p-6 md:p-8' : 'p-6 sm:p-10 md:p-12'
      }`}
      style={{ minHeight: '297mm' }}
    >
      <div>
        {/* Header Row: Logo left, Meta Table right */}
        <div
          className={`flex flex-col md:flex-row md:items-start justify-between border-b-2 border-slate-900 transition-all endoscopy-print-header ${
            isCompactView ? 'gap-3 pb-3' : 'gap-6 pb-6'
          }`}
        >
          {/* Left Side: The Kidney Centre logo & Institutional Details */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-shrink-0">
            <img
              key={getLogoSettings().updatedAt || Date.now()}
              src={getLogoUrlWithCacheBust(getEffectiveLogoBase64())}
              alt="The Kidney Centre"
              className={`h-auto object-contain transition-all ${
                isCompactView
                  ? 'max-w-[130px]'
                  : 'max-w-[150px] sm:max-w-[180px]'
              }`}
              referrerPolicy="no-referrer"
            />
            <div className="border-l-2 border-slate-300 pl-2 text-[8.5px] sm:text-[9.5px] text-slate-700 font-medium leading-tight">
              <p className="font-bold text-slate-900">197/9, Rafiqui Shaheed Road, Karachi-75530.</p>
              <p className="text-slate-600">Phone: PABX 35661000 (10 Lines)</p>
              <p className="text-slate-600">Cell: 0302-8271166, 0347-5661000</p>
            </div>
          </div>

          {/* Right Side: Meta Table */}
          <div
            className={`border border-slate-900 rounded-xl overflow-hidden w-full md:max-w-md transition-all shadow-sm ${
              isCompactView ? 'text-[10px]' : 'text-xs'
            }`}
          >
            <table className="w-full text-left border-collapse">
              <tbody>
                <tr className="border-b border-slate-100">
                  <td
                    className={`font-bold bg-slate-50 border-r border-slate-100 w-1/3 uppercase tracking-wider text-slate-500 transition-all ${
                      isCompactView ? 'px-2.5 py-0.5 text-[8.5px]' : 'px-3 py-1.5 text-[10px]'
                    }`}
                  >
                    Patient Name
                  </td>
                  <td
                    className={`text-slate-900 font-bold uppercase transition-all ${
                      isCompactView ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1.5 text-[11px]'
                    }`}
                  >
                    {formName || 'N/A'}
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td
                    className={`font-bold bg-slate-50 border-r border-slate-100 uppercase tracking-wider text-slate-500 transition-all ${
                      isCompactView ? 'px-2.5 py-0.5 text-[8.5px]' : 'px-3 py-1.5 text-[10px]'
                    }`}
                  >
                    MR Number
                  </td>
                  <td
                    className={`text-slate-900 font-bold uppercase transition-all ${
                      isCompactView ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1.5 text-[11px]'
                    }`}
                  >
                    {formRegNo || 'N/A'}
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td
                    className={`font-bold bg-slate-50 border-r border-slate-100 uppercase tracking-wider text-slate-500 transition-all ${
                      isCompactView ? 'px-2.5 py-0.5 text-[8.5px]' : 'px-3 py-1.5 text-[10px]'
                    }`}
                  >
                    Age / Gender
                  </td>
                  <td
                    className={`text-slate-900 font-bold uppercase transition-all ${
                      isCompactView ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1.5 text-[11px]'
                    }`}
                  >
                    {formAge || 'N/A'} / {formGender || 'N/A'}
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td
                    className={`font-bold bg-slate-50 border-r border-slate-100 uppercase tracking-wider text-slate-500 transition-all ${
                      isCompactView ? 'px-2.5 py-0.5 text-[8.5px]' : 'px-3 py-1.5 text-[10px]'
                    }`}
                  >
                    Procedure Date
                  </td>
                  <td
                    className={`text-slate-900 font-bold uppercase transition-all ${
                      isCompactView ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1.5 text-[11px]'
                    }`}
                  >
                    {formDate || 'N/A'} {formTime ? `@ ${formTime}` : ''}
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td
                    className={`font-bold bg-slate-50 border-r border-slate-100 uppercase tracking-wider text-slate-500 transition-all ${
                      isCompactView ? 'px-2.5 py-0.5 text-[8.5px]' : 'px-3 py-1.5 text-[10px]'
                    }`}
                  >
                    Endoscopist
                  </td>
                  <td
                    className={`text-slate-900 font-bold uppercase transition-all ${
                      isCompactView ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1.5 text-[11px]'
                    }`}
                  >
                    {formDoctor || 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td
                    className={`font-bold bg-slate-50 border-r border-slate-100 uppercase tracking-wider text-slate-500 transition-all ${
                      isCompactView ? 'px-2.5 py-0.5 text-[8.5px]' : 'px-3 py-1.5 text-[10px]'
                    }`}
                  >
                    Ref. Physician
                  </td>
                  <td
                    className={`text-slate-900 font-bold uppercase transition-all ${
                      isCompactView ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1.5 text-[11px]'
                    }`}
                  >
                    {formReferringPhysician || 'N/A'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Procedure Header Banner */}
        <div className={`mt-3.5 mb-1 bg-slate-900 text-white rounded-md border border-slate-950 flex items-center justify-between shadow-sm transition-all ${
          isCompactView ? 'px-3 py-1.5' : 'px-4 py-2.5'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className="p-1 bg-red-600/90 text-white rounded shadow-xs flex items-center justify-center">
              <GastroScopeIcon className="w-4 h-4 text-white" glow />
            </div>
            <h3 className={`font-black tracking-widest uppercase text-white ${
              isCompactView ? 'text-xs' : 'text-sm sm:text-base'
            }`}>
              {formProcedure ? (formProcedure.toUpperCase().includes('REPORT') ? formProcedure.toUpperCase() : `${formProcedure.toUpperCase()} REPORT`) : 'ENDOSCOPY PROCEDURE REPORT'}
            </h3>
          </div>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1"></span>
        </div>

        {/* Main 2-Column Grid for Text & Image alignment */}
        <div className={`grid grid-cols-1 ${formImages && formImages.length > 0 ? 'sm:grid-cols-12 gap-6' : 'grid-cols-1'} transition-all endoscopy-print-main-grid ${isCompactView ? 'mt-3' : 'mt-5'}`}>
          
          {/* Left Column: All Textual/Diagnostic Content */}
          <div className={formImages && formImages.length > 0 ? 'sm:col-span-9 space-y-4 endoscopy-print-left-col' : 'col-span-12 space-y-4'}>
            {/* Procedure Specifics Shaded Block */}
            <div
              className={`bg-slate-50 border border-slate-200 rounded transition-all ${
                isCompactView ? 'p-3 space-y-2' : 'p-4 space-y-3'
              }`}
            >
              <h4
                className={`font-black text-slate-900 tracking-wider uppercase border-b border-slate-200 transition-all ${
                  isCompactView ? 'text-[9px] pb-1' : 'text-[10px] pb-1.5'
                }`}
              >
                PROCEDURE SPECIFICS & CLINICAL METRICS
              </h4>
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${isCompactView ? 'gap-2' : 'gap-4'}`}>
                <div>
                  <span
                    className={`font-bold text-slate-500 block uppercase tracking-wider ${
                      isCompactView ? 'text-[8px]' : 'text-[9px]'
                    }`}
                  >
                    Indications for Exam
                  </span>
                  <span
                    className={`text-slate-950 font-extrabold transition-all ${
                      isCompactView ? 'text-[11px]' : 'text-xs'
                    }`}
                  >
                    {formIndications || 'N/A'}
                  </span>
                </div>
                <div>
                  <span
                    className={`font-bold text-slate-500 block uppercase tracking-wider ${
                      isCompactView ? 'text-[8px]' : 'text-[9px]'
                    }`}
                  >
                    Medications / Sedation
                  </span>
                  <span
                    className={`text-slate-950 font-extrabold uppercase transition-all ${
                      isCompactView ? 'text-[11px]' : 'text-xs'
                    }`}
                  >
                    {formMedications ? formMedications.toUpperCase() : 'N/A'}
                  </span>
                </div>
              </div>
              <div
                className={`grid grid-cols-2 md:grid-cols-4 border-t border-slate-100 transition-all endoscopy-print-metrics-grid-4 ${
                  isCompactView ? 'gap-2 pt-1' : 'gap-4 pt-1.5'
                }`}
              >
                <div>
                  <span
                    className={`font-bold text-slate-400 block uppercase tracking-wider ${
                      isCompactView ? 'text-[7.5px]' : 'text-[8px]'
                    }`}
                  >
                    Instruments Used
                  </span>
                  <span
                    className={`text-slate-800 font-bold transition-all ${
                      isCompactView ? 'text-[10px]' : 'text-xs'
                    }`}
                  >
                    {formInstruments || 'N/A'}
                  </span>
                </div>
                <div>
                  <span
                    className={`font-bold text-slate-400 block uppercase tracking-wider ${
                      isCompactView ? 'text-[7.5px]' : 'text-[8px]'
                    }`}
                  >
                    Visualization
                  </span>
                  <span
                    className={`text-slate-800 font-bold transition-all ${
                      isCompactView ? 'text-[10px]' : 'text-xs'
                    }`}
                  >
                    {formVisualization || 'N/A'}
                  </span>
                </div>
                <div>
                  <span
                    className={`font-bold text-slate-400 block uppercase tracking-wider ${
                      isCompactView ? 'text-[7.5px]' : 'text-[8px]'
                    }`}
                  >
                    Patient Tolerance
                  </span>
                  <span
                    className={`text-slate-800 font-bold transition-all ${
                      isCompactView ? 'text-[10px]' : 'text-xs'
                    }`}
                  >
                    {formTolerance || 'N/A'}
                  </span>
                </div>
                <div>
                  <span
                    className={`font-bold text-slate-400 block uppercase tracking-wider ${
                      isCompactView ? 'text-[7.5px]' : 'text-[8px]'
                    }`}
                  >
                    Complications
                  </span>
                  <span
                    className={`font-bold transition-all ${
                      isCompactView ? 'text-[10px] text-red-600' : 'text-xs text-red-600'
                    }`}
                  >
                    {formComplications || 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Narrative Sections */}
            <div className={`transition-all ${isCompactView ? 'space-y-3' : 'space-y-5'}`}>
              {/* Indications */}
              <div className={isCompactView ? 'space-y-0.5' : 'space-y-1'}>
                <h4
                  className={`font-bold text-slate-900 tracking-wider border-b border-slate-200 pb-0.5 uppercase transition-all ${
                    isCompactView ? 'text-[9.5px]' : 'text-xs'
                  }`}
                >
                  INDICATIONS FOR EXAMINATION
                </h4>
                <p
                  className={`text-slate-700 leading-relaxed font-normal whitespace-pre-wrap transition-all ${
                    isCompactView ? 'text-[9.5px]' : 'text-xs'
                  }`}
                >
                  {formIndications || 'N/A'}
                </p>
              </div>

              {/* Technique */}
              <div className={isCompactView ? 'space-y-0.5' : 'space-y-1'}>
                <h4
                  className={`font-bold text-slate-900 tracking-wider border-b border-slate-200 pb-0.5 uppercase transition-all ${
                    isCompactView ? 'text-[9.5px]' : 'text-xs'
                  }`}
                >
                  PROCEDURE TECHNIQUE
                </h4>
                <p
                  className={`text-slate-700 leading-relaxed font-normal whitespace-pre-wrap transition-all ${
                    isCompactView ? 'text-[9.5px]' : 'text-xs'
                  }`}
                >
                  {formProcedureTechnique || 'N/A'}
                </p>
              </div>

              {/* Detailed Findings & Observations */}
              <div className={isCompactView ? 'space-y-1' : 'space-y-2'}>
                <h4
                  className={`font-bold text-slate-900 tracking-wider border-b border-slate-200 pb-0.5 uppercase transition-all ${
                    isCompactView ? 'text-[9.5px]' : 'text-xs'
                  }`}
                >
                  DETAILED FINDINGS & OBSERVATIONS
                </h4>
                <div className={`transition-all ${isCompactView ? 'space-y-1.5' : 'space-y-3'}`}>
                  {isBronchoscopy ? (
                    <>
                      {formEsophagusFindings && (
                        <div className="leading-normal">
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            VOCAL CORDS & LARYNX:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px] pl-0.5' : 'text-xs pl-1'
                            }`}
                          >
                            {formEsophagusFindings}
                          </p>
                        </div>
                      )}
                      {formStomachFindings && (
                        <div className="leading-normal">
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            TRACHEA & CARINA:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px] pl-0.5' : 'text-xs pl-1'
                            }`}
                          >
                            {formStomachFindings}
                          </p>
                        </div>
                      )}
                      {formDuodenumFindings && (
                        <div className="leading-normal">
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            BRONCHIAL TREE (MAIN & SEGMENTAL):
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px] pl-0.5' : 'text-xs pl-1'
                            }`}
                          >
                            {formDuodenumFindings}
                          </p>
                        </div>
                      )}
                      {formColonFindings && (
                        <div className="leading-normal">
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            BAL & BIOPSY FINDINGS:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px] pl-0.5' : 'text-xs pl-1'
                            }`}
                          >
                            {formColonFindings}
                          </p>
                        </div>
                      )}
                      {formFindings && (
                        <div className="leading-normal">
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            OTHER OBSERVATIONS:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px] pl-0.5' : 'text-xs pl-1'
                            }`}
                          >
                            {formFindings}
                          </p>
                        </div>
                      )}
                      {!formEsophagusFindings &&
                        !formStomachFindings &&
                        !formDuodenumFindings &&
                        !formFindings && (
                          <p className={`text-slate-400 italic ${isCompactView ? 'text-[9px]' : 'text-xs'}`}>
                            No detailed findings recorded.
                          </p>
                        )}
                    </>
                  ) : isColonoscopy ? (
                    <>
                      {formRectumFindings && (
                        <div
                          className={`leading-normal border-l-2 border-red-500 transition-all ${
                            isCompactView ? 'pl-2' : 'pl-3'
                          }`}
                        >
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            RECTUM:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px]' : 'text-xs'
                            }`}
                          >
                            {formRectumFindings}
                          </p>
                        </div>
                      )}
                      {formSigmoidColonFindings && (
                        <div
                          className={`leading-normal border-l-2 border-red-500 transition-all ${
                            isCompactView ? 'pl-2' : 'pl-3'
                          }`}
                        >
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            SIGMOID COLON:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px]' : 'text-xs'
                            }`}
                          >
                            {formSigmoidColonFindings}
                          </p>
                        </div>
                      )}
                      {formTransverseColonFindings && (
                        <div
                          className={`leading-normal border-l-2 border-red-500 transition-all ${
                            isCompactView ? 'pl-2' : 'pl-3'
                          }`}
                        >
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            TRANSVERSE COLON:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px]' : 'text-xs'
                            }`}
                          >
                            {formTransverseColonFindings}
                          </p>
                        </div>
                      )}
                      {formDescendingColonFindings && (
                        <div
                          className={`leading-normal border-l-2 border-red-500 transition-all ${
                            isCompactView ? 'pl-2' : 'pl-3'
                          }`}
                        >
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            DESCENDING COLON:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px]' : 'text-xs'
                            }`}
                          >
                            {formDescendingColonFindings}
                          </p>
                        </div>
                      )}
                      {formAscendingColonFindings && (
                        <div
                          className={`leading-normal border-l-2 border-red-500 transition-all ${
                            isCompactView ? 'pl-2' : 'pl-3'
                          }`}
                        >
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            ASCENDING COLON:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px]' : 'text-xs'
                            }`}
                          >
                            {formAscendingColonFindings}
                          </p>
                        </div>
                      )}
                      {formCaecumFindings && (
                        <div
                          className={`leading-normal border-l-2 border-red-500 transition-all ${
                            isCompactView ? 'pl-2' : 'pl-3'
                          }`}
                        >
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            CAECUM:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px]' : 'text-xs'
                            }`}
                          >
                            {formCaecumFindings}
                          </p>
                        </div>
                      )}
                      {formFindings && (
                        <div
                          className={`leading-normal border-l-2 border-indigo-100 transition-all ${
                            isCompactView ? 'pl-2' : 'pl-3'
                          }`}
                        >
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            OTHER OBSERVATIONS:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px]' : 'text-xs'
                            }`}
                          >
                            {formFindings}
                          </p>
                        </div>
                      )}
                      {!formRectumFindings &&
                        !formSigmoidColonFindings &&
                        !formTransverseColonFindings &&
                        !formDescendingColonFindings &&
                        !formAscendingColonFindings &&
                        !formCaecumFindings &&
                        !formFindings && (
                          <p className={`text-slate-400 italic ${isCompactView ? 'text-[9px]' : 'text-xs'}`}>
                            No detailed findings recorded.
                          </p>
                        )}
                    </>
                  ) : (
                    <>
                      {formEsophagusFindings && (
                        <div
                          className={`leading-normal border-l-2 border-indigo-100 transition-all ${
                            isCompactView ? 'pl-2' : 'pl-3'
                          }`}
                        >
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            ESOPHAGUS:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px]' : 'text-xs'
                            }`}
                          >
                            {formEsophagusFindings}
                          </p>
                        </div>
                      )}
                      {formStomachFindings && (
                        <div
                          className={`leading-normal border-l-2 border-indigo-100 transition-all ${
                            isCompactView ? 'pl-2' : 'pl-3'
                          }`}
                        >
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            STOMACH:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px]' : 'text-xs'
                            }`}
                          >
                            {formStomachFindings}
                          </p>
                        </div>
                      )}
                      {formAntrumFindings && (
                        <div
                          className={`leading-normal border-l-2 border-indigo-100 transition-all ${
                            isCompactView ? 'pl-2' : 'pl-3'
                          }`}
                        >
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            ANTRUM:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px]' : 'text-xs'
                            }`}
                          >
                            {formAntrumFindings}
                          </p>
                        </div>
                      )}
                      {formDuodenumFindings && (
                        <div
                          className={`leading-normal border-l-2 border-indigo-100 transition-all ${
                            isCompactView ? 'pl-2' : 'pl-3'
                          }`}
                        >
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            DUODENUM BULB:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px]' : 'text-xs'
                            }`}
                          >
                            {formDuodenumFindings}
                          </p>
                        </div>
                      )}
                      {formDuodenum2ndPartFindings && (
                        <div
                          className={`leading-normal border-l-2 border-indigo-100 transition-all ${
                            isCompactView ? 'pl-2' : 'pl-3'
                          }`}
                        >
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            DUODENUM 2ND PART:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px]' : 'text-xs'
                            }`}
                          >
                            {formDuodenum2ndPartFindings}
                          </p>
                        </div>
                      )}

                      {formColonFindings && (
                        <div
                          className={`leading-normal border-l-2 border-indigo-100 transition-all ${
                            isCompactView ? 'pl-2' : 'pl-3'
                          }`}
                        >
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            COLON / RECTUM:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px]' : 'text-xs'
                            }`}
                          >
                            {formColonFindings}
                          </p>
                        </div>
                      )}

                      {formFindings && (
                        <div
                          className={`leading-normal border-l-2 border-indigo-100 transition-all ${
                            isCompactView ? 'pl-2' : 'pl-3'
                          }`}
                        >
                          <span
                            className={`font-extrabold text-slate-950 block uppercase tracking-wide transition-all ${
                              isCompactView ? 'text-[9px] mb-0' : 'text-xs mb-0.5'
                            }`}
                          >
                            OTHER OBSERVATIONS:
                          </span>
                          <p
                            className={`text-slate-700 whitespace-pre-wrap transition-all ${
                              isCompactView ? 'text-[9.5px]' : 'text-xs'
                            }`}
                          >
                            {formFindings}
                          </p>
                        </div>
                      )}
                      {!formEsophagusFindings &&
                        !formStomachFindings &&
                        !formAntrumFindings &&
                        !formDuodenumFindings &&
                        !formDuodenum2ndPartFindings &&
                        !formColonFindings &&
                        !formFindings && (
                          <p className={`text-slate-400 italic ${isCompactView ? 'text-[9px]' : 'text-xs'}`}>
                            No detailed findings recorded.
                          </p>
                        )}
                    </>
                  )}
                </div>
              </div>

              {/* Assessment */}
              <div className={isCompactView ? 'space-y-0.5' : 'space-y-1'}>
                <h4
                  className={`font-bold text-slate-900 tracking-wider border-b border-slate-200 pb-0.5 uppercase transition-all ${
                    isCompactView ? 'text-[9.5px]' : 'text-xs'
                  }`}
                >
                  ASSESSMENT
                </h4>
                <div
                  className={`bg-slate-50 border-l-4 border-slate-900 rounded-lg border border-slate-200 shadow-sm transition-all ${
                    isCompactView ? 'px-3 py-1.5' : 'px-3.5 py-2.5'
                  }`}
                >
                  <p
                    className={`text-slate-900 leading-relaxed font-extrabold uppercase tracking-wide transition-all ${
                      isCompactView ? 'text-[8.5px]' : 'text-[10px]'
                    }`}
                  >
                    Diagnosis:
                  </p>
                  <p
                    className={`text-slate-900 leading-relaxed font-bold transition-all ${
                      isCompactView ? 'text-[9.5px] mt-0.5' : 'text-xs mt-1'
                    }`}
                  >
                    {formDiagnosis || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Recommendations */}
              <div className={isCompactView ? 'space-y-0.5' : 'space-y-1'}>
                <h4
                  className={`font-bold text-slate-900 tracking-wider border-b border-slate-200 pb-0.5 uppercase transition-all ${
                    isCompactView ? 'text-[9.5px]' : 'text-xs'
                  }`}
                >
                  RECOMMENDATIONS
                </h4>
                <div
                  className={`bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-all ${
                    isCompactView ? 'px-3 py-1.5' : 'px-3.5 py-2.5'
                  }`}
                >
                  <p
                    className={`text-slate-800 leading-relaxed font-semibold whitespace-pre-wrap transition-all ${
                      isCompactView ? 'text-[9.5px]' : 'text-xs'
                    }`}
                  >
                    {formRecommendations || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Dynamic Stack of Clinical Photos */}
          {formImages && formImages.length > 0 && (
            <div className="sm:col-span-3 flex flex-col space-y-3.5 border-l border-slate-200 sm:pl-4 endoscopy-print-right-col">
              <h4
                className={`font-bold text-slate-900 tracking-wider border-b border-slate-200 pb-0.5 uppercase transition-all ${
                  isCompactView ? 'text-[9px]' : 'text-[10px]'
                }`}
              >
                CLINICAL PHOTOGRAPHS
              </h4>
              <div className="flex flex-col gap-3 endoscopy-print-image-list">
                {formImages.map((img, idx) => (
                  <div
                    key={img.id || idx}
                    className={`border border-slate-150 rounded-lg bg-slate-50 flex flex-col shadow-sm transition-all w-full ${
                      isCompactView ? 'max-w-[120px] p-1 space-y-0.5' : 'max-w-[140px] p-1.5 space-y-1'
                    } mx-auto endoscopy-print-image-card`}
                  >
                    <img
                      src={img.url}
                      alt={img.title || 'Clinical view'}
                      className="aspect-[4/3] w-full object-cover rounded border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                    <p
                      className={`font-black text-slate-600 truncate px-1 text-center transition-all ${
                        isCompactView ? 'text-[8px]' : 'text-[9px]'
                      }`}
                      title={img.title}
                    >
                      {img.title || `Capture ${idx + 1}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Signatures & Footer sticking to the bottom */}
      <div className={`border-t border-slate-300 transition-all ${isCompactView ? 'mt-6 pt-4' : 'mt-10 pt-6'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-end gap-6">
          <div className="w-full sm:w-1/3 max-w-xs space-y-1.5">
            <div className="h-0.5 bg-slate-400 w-full" />
            <p className={`font-black text-slate-600 uppercase tracking-widest ${isCompactView ? 'text-[8px]' : 'text-[9px]'}`}>
              Performing Physician / Endoscopist Signature
            </p>
          </div>

          {/* Embedded Digital Verification QR Code Card */}
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg p-2 shadow-2xs">
            <div className="bg-white p-1 rounded border border-slate-200">
              <QRCodeSVG 
                value={getVerificationUrl('endoscopy', formRegNo || '1', { mrn: formRegNo, name: formName, date: formDate })} 
                size={isCompactView ? 46 : 54} 
                level="M" 
              />
            </div>
            <div className="text-left space-y-0.5">
              <div className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span className="font-extrabold text-[8.5px] uppercase tracking-wider">Verified Clinical Record</span>
              </div>
              <p className="text-[8px] font-mono font-bold text-slate-800">MRN: {formRegNo || 'N/A'}</p>
              <p className="text-[7.5px] text-slate-500">Scan QR code for authentic verification</p>
              <p className="text-[7px] text-slate-400 font-medium">The Kidney Centre Medical Records</p>
            </div>
          </div>
        </div>

        <p className={`font-extrabold text-slate-400 uppercase tracking-widest text-center transition-all ${isCompactView ? 'text-[7.5px] mt-4' : 'text-[8.5px] mt-6'}`}>
          CONFIDENTIAL CLINICAL DOCUMENT — FOR HEALTHCARE PROFESSIONAL USE ONLY
        </p>
      </div>
    </div>
  );
};
