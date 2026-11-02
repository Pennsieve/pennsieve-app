/**
 * Package state presentation.
 *
 * READY means the package's file has been cleared by the malware scanner;
 * processing no longer decides state (there are no automated processors).
 *
 *   UNAVAILABLE  the upload hasn't finished                 -> "Uploading"
 *   UPLOADED     uploaded, waiting for the scan verdict     -> "Scanning…"
 *   READY        cleared by the scan (or too big to scan)   -> no badge
 *   INFECTED     the scan found a threat (quarantined)      -> "Quarantined"
 *   ERROR        the scan failed for good                   -> "Failed"
 *                (a legacy ERROR whose file is infected     -> "Quarantined")
 *
 * Only READY packages can be downloaded or opened in a viewer. Which viewer
 * opens depends on what data exists for the package (channels, a Zarr bundle,
 * slide tiles, the source file), never on the state.
 *
 * PROCESSING / RUNNING / PENDING are legacy states of the retired processing
 * pipeline; a few old packages may still rest in them.
 */

import { pathOr } from "ramda";
import { SCAN_STATUS } from "@/utils/scan-status";

export const PACKAGE_STATE = {
  UNAVAILABLE: "UNAVAILABLE",
  UPLOADED: "UPLOADED",
  READY: "READY",
  ERROR: "ERROR",
  // The malware scan found a threat: quarantined, never downloadable.
  INFECTED: "INFECTED",
  PROCESSING: "PROCESSING",
  RUNNING: "RUNNING",
  PENDING: "PENDING",
  // Client-side placeholder states (see uploadModule getPlaceholdersForFolder).
  UPLOADING: "UPLOADING",
  IMPORTING: "IMPORTING",
};

/**
 * Status keys, for components that style or branch on the status.
 */
export const PACKAGE_STATUS = {
  UPLOADING: "uploading",
  IMPORTING: "importing",
  SCANNING: "scanning",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
};

const STATUS_BY_STATE = {
  [PACKAGE_STATE.UNAVAILABLE]: PACKAGE_STATUS.UPLOADING,
  [PACKAGE_STATE.UPLOADING]: PACKAGE_STATUS.UPLOADING,
  [PACKAGE_STATE.IMPORTING]: PACKAGE_STATUS.IMPORTING,
  [PACKAGE_STATE.UPLOADED]: PACKAGE_STATUS.SCANNING,
  [PACKAGE_STATE.PROCESSING]: PACKAGE_STATUS.PROCESSING,
  [PACKAGE_STATE.RUNNING]: PACKAGE_STATUS.PROCESSING,
  [PACKAGE_STATE.PENDING]: PACKAGE_STATUS.PROCESSING,
  [PACKAGE_STATE.READY]: PACKAGE_STATUS.READY,
  [PACKAGE_STATE.ERROR]: PACKAGE_STATUS.FAILED,
  [PACKAGE_STATE.INFECTED]: PACKAGE_STATUS.FAILED,
};

/**
 * The package's state, from a package DTO.
 * @param {Object} pkg package DTO (`{ content: { state } }`)
 * @returns {String}
 */
export const packageState = (pkg) => pathOr("", ["content", "state"], pkg);

/**
 * The status key for a package state, or "" for a state this build doesn't
 * know (DELETING, RESTORING, ...).
 * @param {String} state
 * @returns {String}
 */
export const packageStatus = (state) => STATUS_BY_STATE[state] || "";

/**
 * True when the package has been cleared by the scan: the only state in
 * which it can be downloaded or viewed.
 * @param {Object} pkg package DTO
 * @returns {Boolean}
 */
export const isPackageReady = (pkg) => packageState(pkg) === PACKAGE_STATE.READY;

/**
 * True for a package that is still in flight: uploading, waiting for its
 * scan, or (legacy) processing. These show the waiting icon.
 * @param {String} state
 * @returns {Boolean}
 */
export const isPackageInFlight = (state) =>
  [
    PACKAGE_STATUS.UPLOADING,
    PACKAGE_STATUS.SCANNING,
    PACKAGE_STATUS.PROCESSING,
  ].includes(packageStatus(state));

/**
 * The user-facing label for a package state. READY gets no label: the file
 * is simply available.
 *
 * @param {String} state `packages.state`
 * @param {String} [scanStatus] the file's `scan_status`, when known; an
 *   ERROR package whose file is infected reads as quarantined
 * @returns {String}
 */
export const packageStateLabel = (state, scanStatus) => {
  switch (packageStatus(state)) {
    case PACKAGE_STATUS.UPLOADING:
      return "Uploading";
    case PACKAGE_STATUS.IMPORTING:
      return "Importing…";
    case PACKAGE_STATUS.SCANNING:
      return "Scanning…";
    case PACKAGE_STATUS.PROCESSING:
      return "Processing";
    case PACKAGE_STATUS.FAILED:
      return state === PACKAGE_STATE.INFECTED ||
        scanStatus === SCAN_STATUS.INFECTED
        ? "Quarantined"
        : "Failed";
    default:
      return "";
  }
};
