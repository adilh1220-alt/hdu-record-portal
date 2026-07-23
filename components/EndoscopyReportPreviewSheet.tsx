import React from 'react';
import { generateKidneyCentreLogoBase64 } from '../services/pdfService';

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
      className={`bg-white text-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border border-slate-200 w-full max-w-4xl flex flex-col justify-between relative select-text transition-all duration-300 endoscopy-print-sheet ${
        isCompactView ? 'p-6 sm:p-9' : 'p-8 sm:p-14'
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
          {/* Left Side: Kidney Centre logo in base64 */}
          <div className="flex-shrink-0">
            <img
              src={generateKidneyCentreLogoBase64()}
              alt="The Kidney Centre"
              className={`w-full h-auto object-contain border-2 border-slate-950 bg-white shadow-sm transition-all ${
                isCompactView
                  ? 'max-w-[210px] p-1'
                  : 'max-w-[280px] sm:max-w-[360px] md:max-w-[440px] p-2'
              }`}
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Right Side: Meta Table */}
          <div
            className={`border border-slate-200 rounded overflow-hidden w-full md:max-w-md transition-all ${
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
              <div className={`grid grid-cols-1 md:grid-cols-2 endoscopy-print-metrics-grid-2 ${isCompactView ? 'gap-2' : 'gap-4'}`}>
                <div>
                  <span
                    className={`font-bold text-slate-500 block uppercase tracking-wider ${
                      isCompactView ? 'text-[8px]' : 'text-[9px]'
                    }`}
                  >
                    Procedure Performed
                  </span>
                  <span
                    className={`text-slate-950 font-extrabold transition-all ${
                      isCompactView ? 'text-[11px]' : 'text-xs'
                    }`}
                  >
                    {formProcedure || 'N/A'}
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
                    className={`text-slate-950 font-extrabold transition-all ${
                      isCompactView ? 'text-[11px]' : 'text-xs'
                    }`}
                  >
                    {formMedications || 'N/A'}
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
                  className={`bg-slate-50 border-l-4 border-slate-900 rounded-r shadow-sm transition-all ${
                    isCompactView ? 'px-2.5 py-1' : 'px-3 py-2'
                  }`}
                >
                  <p
                    className={`text-slate-950 leading-relaxed font-extrabold uppercase tracking-wide transition-all ${
                      isCompactView ? 'text-[8.5px]' : 'text-[10px]'
                    }`}
                  >
                    Diagnosis:
                  </p>
                  <p
                    className={`text-slate-800 leading-relaxed font-bold transition-all ${
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
                <p
                  className={`text-slate-700 leading-relaxed font-normal whitespace-pre-wrap transition-all ${
                    isCompactView ? 'text-[9.5px]' : 'text-xs'
                  }`}
                >
                  {formRecommendations || 'N/A'}
                </p>
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
      <div className={`border-t border-slate-200 transition-all ${isCompactView ? 'mt-8 pt-4' : 'mt-16 pt-10'}`}>
        <div className={`flex flex-col sm:flex-row justify-start items-center text-center transition-all ${isCompactView ? 'gap-4' : 'gap-8'}`}>
          <div className="w-full sm:w-1/3 space-y-1.5">
            <div className="h-0.5 bg-slate-300 w-full" />
            <p className={`font-black text-slate-500 uppercase tracking-widest ${isCompactView ? 'text-[8px]' : 'text-[9px]'}`}>
              Performing Physician Signature
            </p>
          </div>
        </div>

        <div
          className={`text-center font-black tracking-widest text-slate-400 uppercase leading-relaxed border-t border-slate-100 transition-all ${
            isCompactView ? 'mt-5 pt-2 text-[7px]' : 'mt-10 pt-4 text-[8px]'
          }`}
        >
          REPORT COMPILED BY THE KIDNEY CENTRE. GENERATED BY:{' '}
          {(currentUser?.displayName || currentUser?.email || 'Attending Physician').toUpperCase()}{' '}
          ON {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
};
