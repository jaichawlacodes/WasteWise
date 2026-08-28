"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { MapPin, Upload, CheckCircle, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createUser,
  getUserByEmail,
  createReport,
  getRecentReports,
} from "../../utils/db/action";
import { toast } from "react-hot-toast";

const MapLibreLocation = dynamic(() => import("@/components/MapLibreLocation"), {
  ssr: false,
  loading: () => <div className="h-48 w-full rounded-xl border border-gray-200 bg-gray-50" />,
});

export default function ReportPage() {
  const [user, setUser] = useState<{
    id: number;
    email: string | null;
    name: string | null;
  } | null>(null);

  const [reports, setReports] = useState<
    Array<{
      id: number;
      location: string;
      wasteType: string;
      amount: string;
      createdAt: string;
    }>
  >([]);

  const [newReport, setNewReport] = useState({
    location: "",
    type: "",
    amount: "",
  });

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "verifying" | "success" | "failure"
  >("idle");
  const [verificationResult, setVerificationResult] = useState<{
    wasteType: string;
    quantity: string;
    confidence: number;
    humanOrAnimalDetected: boolean;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationCoordinates, setLocationCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setNewReport({ ...newReport, [name]: value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleVerify = async () => {
    if (!file) return;

    setVerificationStatus("verifying");

    try {
      const prompt = `
You are an expert in waste management and recycling. Analyze the ENTIRE image very carefully and:

1. Detect and identify **every type of waste** visible in the image (e.g., plastic, paper, glass, metal, organic, e-waste, hazardous materials, etc.).
2. Estimate the **total quantity** of all waste combined in appropriate units (like kg, grams, or liters).
3. Provide a **confidence level** for your assessment as a decimal between 0 and 1.
4. If a **human or animal** is detected in the image, set \`humanOrAnimalDetected\` to \`true\`, but **still analyze the waste normally**.
5. Make sure no type of waste is missed by carefully examining **all areas of the image**.

Respond **only** with the following JSON object and nothing else:

{
  "wasteType": "list all types of waste found, separated by commas",
  "quantity": "total estimated quantity with unit",
  "confidence": confidence level as a number between 0 and 1,
  "humanOrAnimalDetected": true/false
}
`;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("prompt", prompt);
      const result = await fetch("/api/gemini", { method: "POST", body: formData });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error ?? "Gemini request failed");
      let text = payload.text as string;

      try {
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          text = text.substring(jsonStart, jsonEnd + 1);
        } else {
          console.error("Invalid JSON response format:", text);
          setVerificationStatus("failure");
          return;
        }

        const parsedResult = JSON.parse(text);

        if (
          parsedResult.wasteType &&
          parsedResult.quantity &&
          parsedResult.confidence &&
          typeof parsedResult.humanOrAnimalDetected === "boolean"
        ) {
          setVerificationResult(parsedResult);
          setVerificationStatus("success");
          setNewReport({
            ...newReport,
            type: parsedResult.wasteType,
            amount: parsedResult.quantity,
          });
        } else {
          console.error(
            "Invalid verification result (missing fields):",
            parsedResult
          );
          setVerificationStatus("failure");
        }
      } catch (error) {
        console.error("Failed to parse JSON response:", text, error);
        setVerificationStatus("failure");
      }
    } catch (error) {
      console.error("Error verifying waste:", error);
      setVerificationStatus("failure");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationStatus !== "success") {
      toast.error("Please verify the waste before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const report = await createReport(
        user ? user.id : null, // allow anonymous submission
        newReport.location,
        newReport.type,
        newReport.amount,
        preview || undefined,
        undefined,
        verificationResult ? JSON.stringify({
          ...verificationResult,
          locationCoordinates,
        }) : undefined
      );

      if (!report) {
        throw new Error("Failed to create report");
      }

      const formattedReport = {
        id: report.id,
        location: report.location ?? "",
        wasteType: report.wasteType ?? "",
        amount: report.amount ?? "",
        createdAt: report.createdAt?.toISOString().split("T")[0] ?? "",
      };

      setReports([formattedReport, ...reports]);
      setNewReport({ location: "", type: "", amount: "" });
      setFile(null);
      setPreview(null);
      setLocationCoordinates(null);
      setVerificationStatus("idle");
      setVerificationResult(null);

      toast.success("Report submitted successfully!");
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const email = localStorage.getItem("userEmail");
      const userPromise = email
        ? getUserByEmail(email).then((existingUser) => (
            existingUser ?? createUser(email, "Anonymous User")
          ))
        : Promise.resolve(null);
      const [user, recentReports] = await Promise.all([
        userPromise,
        getRecentReports(),
      ]);
      setUser(user);
      const formattedReports = recentReports.map((report) => ({
        id: report.id,
        location: report.location ?? "",
        wasteType: report.wasteType ?? "",
        amount: report.amount ?? "",
        createdAt: report.createdAt?.toISOString().split("T")[0] ?? "",
      }));
      setReports(formattedReports);
    };
    init();
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">
        Report waste
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-lg mb-12"
      >
        {/* Upload Section */}
        <div className="mb-8">
          <label
            htmlFor="waste-image"
            className="block text-lg font-medium text-gray-700 mb-2"
          >
            Upload Waste Image
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-green-500 transition-colors duration-300">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label
                  htmlFor="waste-image"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-green-500"
                >
                  <span>Upload a file</span>
                  <input
                    id="waste-image"
                    name="waste-image"
                    type="file"
                    className="sr-only"
                    onChange={handleFileChange}
                    accept="image/*"
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </div>
          </div>
        </div>

        {preview && (
          <div className="mt-4 mb-8">
            <img
              src={preview}
              alt="Waste preview"
              className="max-w-full h-auto rounded-xl shadow-md"
            />
          </div>
        )}

        <Button
          type="button"
          onClick={handleVerify}
          className="w-full mb-8 bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg rounded-xl transition-colors duration-300"
          disabled={!file || verificationStatus === "verifying"}
        >
          {verificationStatus === "verifying" ? (
            <>
              <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              Verifying...
            </>
          ) : (
            "Verify Waste"
          )}
        </Button>

        {verificationStatus === "success" && verificationResult && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-8 rounded-r-xl">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 text-green-400 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-green-800">
                  Verification Successful
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Waste Type: {verificationResult.wasteType}</p>
                  <p>Quantity: {verificationResult.quantity}</p>
                  <p>
                    Confidence:{" "}
                    {(verificationResult.confidence * 100).toFixed(2)}%
                  </p>
                  <p>
                    Human/Animal Detected:{" "}
                    {verificationResult.humanOrAnimalDetected ? "Yes" : "No"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <label
              htmlFor="location"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Location
            </label>
            <MapLibreLocation
              value={newReport.location}
              onChange={(location) => {
                setLocationCoordinates(location ? {
                  latitude: location.latitude,
                  longitude: location.longitude,
                } : null);
                setNewReport((prev) => ({ ...prev, location: location?.address ?? prev.location }));
              }}
            />
          </div>
          <div>
            <label
              htmlFor="type"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Waste Type
            </label>
            <input
              type="text"
              id="type"
              name="type"
              value={newReport.type}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
              placeholder="Verified waste type"
              readOnly
            />
          </div>
          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Estimated Amount
            </label>
            <input
              type="text"
              id="amount"
              name="amount"
              value={newReport.amount}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
              placeholder="Verified amount"
              readOnly
            />
          </div>
        </div>
        <Button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg rounded-xl transition-colors duration-300 flex items-center justify-center"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              Submitting...
            </>
          ) : (
            "Submit Report"
          )}
        </Button>
      </form>

      {/* Recent Reports */}
      <h2 className="text-3xl font-semibold mb-6 text-gray-800">
        Recent Reports
      </h2>
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reports.map((report) => (
                <tr
                  key={report.id}
                  className="hover:bg-gray-50 transition-colors duration-200"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <MapPin className="inline-block w-4 h-4 mr-2 text-green-500" />
                    {report.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.wasteType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.amount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.createdAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
