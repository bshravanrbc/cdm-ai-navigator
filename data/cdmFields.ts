
import { CDMField } from '../types';

export const INITIAL_CDM_FIELDS: CDMField[] = [
  { objectType: "Stub for supporting data classes", fieldName: "Name", label: "Name", type: "Text", description: "Holds name while creating entities" },
  { objectType: "Stub for supporting data classes", fieldName: "Origin", label: "Origin of data", type: "Text", description: "Provides the system of record name that the record was sourced from to assist troubleshooting." },
  { objectType: "Person type", fieldName: "ID", label: "Reference identifier", type: "Identifier", description: "Abstract class that serves as the parent for all reference data in our model" },
  { objectType: "Person type", fieldName: "IsActive", label: "Is active", type: "TrueFalse", description: "IsActive is used for setting a reference data record as Active or InActive." },
  { objectType: "Product type", fieldName: "ID", label: "Reference identifier", type: "Identifier", description: "Abstract class that serves as the parent for all reference data in our model" },
  { objectType: "Account", fieldName: "AccountID", label: "Account ID", type: "Identifier", description: "Unique identifier for the account record which is often can be a composite when sourcing from legacy systems." },
  { objectType: "Account", fieldName: "Currency", label: "Type of currency", type: "Picklist", description: "Holds currency ISO code" },
  { objectType: "Account", fieldName: "LegalName", label: "Legal name", type: "Text", description: "Full legal name of the entity associated with the account" },
  { objectType: "Business account", fieldName: "NetSalesAmount", label: "Net sales amount", type: "Decimal", description: "Net Sales Amount for the organization" },
  { objectType: "Asset", fieldName: "VIN", label: "Vehicle identification number", type: "Text", description: "The Vehicle Identification Number (VIN) is the identifying code for a specific automobile." },
  { objectType: "Claim", fieldName: "ClaimID", label: "Claim ID", type: "Identifier", description: "Unique identifier for the claim record." },
  { objectType: "Transaction", fieldName: "TransactionID", label: "Transaction ID", type: "Identifier", description: "Holds unique transaction ID for tracking." },
  { objectType: "Transaction module", fieldName: "SwiftUETRIdentifier", label: "Swift uetr identifier", type: "Text", description: "The Unique End-to-End Transaction Reference (UETR) is a 36-character alphanumeric code." },
  { objectType: "Service account", fieldName: "AvailableLoanAmount", label: "Available loan amount", type: "Decimal", description: "Cash value available after loan has been taken" }
];
