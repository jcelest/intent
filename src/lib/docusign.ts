import { createPrivateKey } from "node:crypto";
import { SITE_URL } from "@/lib/seo";
import { leadNetWebsiteAgreementHtml } from "@/lib/capture-agreement";
import {
  calculateLeadNetOrder,
  type LeadNetCustomerDetails,
  type LeadNetOrderSelection,
} from "@/lib/leadnet-offer";

const AUTH_URL =
  process.env.DOCUSIGN_AUTH_BASE || "https://account-d.docusign.com";
const API_BASE =
  process.env.DOCUSIGN_API_BASE || "https://demo.docusign.net/restapi";

function privateKey() {
  return (process.env.DOCUSIGN_RSA_PRIVATE_KEY || "").replaceAll("\\n", "\n");
}

async function getAccessToken() {
  const { SignJWT } = await import("jose");
  const key = createPrivateKey(privateKey());
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    iss: process.env.DOCUSIGN_INTEGRATION_KEY,
    sub: process.env.DOCUSIGN_USER_ID,
    aud: AUTH_URL.replace("https://", ""),
    scope: "signature impersonation",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const response = await fetch(`${AUTH_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || "DocuSign auth failed");
  }
  return payload.access_token as string;
}

export async function startCaptureSigning(input: {
  details?: LeadNetCustomerDetails;
  selection?: LeadNetOrderSelection;
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  returnUrl: string;
}) {
  const token = await getAccessToken();
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID!;
  const details =
    input.details ??
    ({
      name: input.name || "",
      company: input.company || "",
      email: input.email || "",
      phone: input.phone || "",
      industry: "",
      domainStatus: "",
      services: "",
      serviceAreas: "",
      brandingAssets: "",
      notes: "",
    } satisfies LeadNetCustomerDetails);
  const order = calculateLeadNetOrder(input.selection ?? {});
  const html = leadNetWebsiteAgreementHtml({ details, order });
  const documentBase64 = Buffer.from(html, "utf8").toString("base64");

  const envelopeRes = await fetch(
    `${API_BASE}/v2.1/accounts/${accountId}/envelopes`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emailSubject: "Intent Website Agreement",
        status: "sent",
        documents: [
          {
            documentId: "1",
            name: "Intent Website Agreement.html",
            fileExtension: "html",
            documentBase64,
          },
        ],
        recipients: {
          signers: [
            {
              email: details.email,
              name: details.name,
              recipientId: "1",
              clientUserId: "capture-signer",
              routingOrder: "1",
              tabs: {
                signHereTabs: [
                  {
                    documentId: "1",
                    anchorString: "Client signature:",
                    anchorUnits: "pixels",
                    anchorXOffset: "130",
                    anchorYOffset: "-8",
                    anchorIgnoreIfNotPresent: "false",
                    anchorCaseSensitive: "true",
                  },
                ],
                dateSignedTabs: [
                  {
                    documentId: "1",
                    anchorString: "Date signed:",
                    anchorUnits: "pixels",
                    anchorXOffset: "85",
                    anchorYOffset: "-4",
                    anchorIgnoreIfNotPresent: "false",
                    anchorCaseSensitive: "true",
                  },
                ],
              },
            },
          ],
        },
      }),
    }
  );
  const envelope = await envelopeRes.json();
  if (!envelopeRes.ok) {
    throw new Error(envelope.message || "Could not create the agreement.");
  }

  const viewRes = await fetch(
    `${API_BASE}/v2.1/accounts/${accountId}/envelopes/${envelope.envelopeId}/views/recipient`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        returnUrl: input.returnUrl,
        authenticationMethod: "none",
        email: details.email,
        userName: details.name,
        clientUserId: "capture-signer",
      }),
    }
  );
  const view = await viewRes.json();
  if (!viewRes.ok || !view.url) {
    throw new Error(view.message || "Could not open signing.");
  }

  return { url: view.url as string, envelopeId: envelope.envelopeId as string };
}

export function docusignConsentUrl() {
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
  if (!integrationKey) return null;
  const redirect = process.env.DOCUSIGN_REDIRECT_URI || `${SITE_URL}/begin`;
  return `${AUTH_URL}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${integrationKey}&redirect_uri=${encodeURIComponent(redirect)}`;
}
