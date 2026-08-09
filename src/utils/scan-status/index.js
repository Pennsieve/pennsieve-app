/**
 * Virus-scan status presentation.
 *
 * Single source of truth for turning a `files.scan_status` value into
 * something renderable. See docs/virus-scan-ui-plan.md §2 for the value
 * vocabulary and the reasoning behind the badge policy.
 *
 * Eight values are legal in the DB CHECK constraint but only six are ever
 * written — `scanning` and `not_required` are reserved and unused.
 */

export const SCAN_STATUS = {
  PENDING: "pending",
  SCANNING: "scanning",
  CLEAN: "clean",
  FORMAT_VALIDATED: "format_validated",
  UNSCANNED: "unscanned",
  INFECTED: "infected",
  FAILED: "failed",
  NOT_REQUIRED: "not_required",
};

/**
 * Severity ordering, worst first. Used both to pick a presentation and to
 * aggregate a multi-file package down to one status.
 *
 * `unscanned` deliberately outranks `pending`: pending is transient and
 * self-resolving, unscanned is terminal.
 */
const SEVERITY = [
  SCAN_STATUS.INFECTED,
  SCAN_STATUS.FAILED,
  SCAN_STATUS.UNSCANNED,
  SCAN_STATUS.PENDING,
  SCAN_STATUS.SCANNING,
  SCAN_STATUS.FORMAT_VALIDATED,
  SCAN_STATUS.CLEAN,
  SCAN_STATUS.NOT_REQUIRED,
];

/**
 * Statuses the API refuses to issue a presigned URL for.
 * Mirrors `scanStatusBlocks` in pennsieve-api and packages-service.
 */
const BLOCKING = [SCAN_STATUS.INFECTED, SCAN_STATUS.FAILED];

/**
 * Statuses that warrant a badge in an unbounded list context. The OK states
 * are omitted on purpose — the vast majority of files are clean, so badging
 * them is noise that destroys the signal value of the red one.
 */
const NEEDS_ATTENTION = [
  SCAN_STATUS.INFECTED,
  SCAN_STATUS.FAILED,
  SCAN_STATUS.UNSCANNED,
];

/**
 * `scan_skip_reason` is free text — it holds policy reasons but also raw
 * clamd error strings. Only the known policy values get user-facing copy;
 * anything else is withheld rather than shown verbatim.
 */
const SKIP_REASON_COPY = {
  size: "File is above the automatic scan size limit.",
  format_invalid_oversized:
    "File did not match its declared format and is too large to scan.",
};

const PRESENTATION = {
  [SCAN_STATUS.CLEAN]: {
    severity: "ok",
    label: "No threats detected",
    icon: "check",
  },
  [SCAN_STATUS.FORMAT_VALIDATED]: {
    severity: "ok",
    label: "Format validated",
    icon: "check",
  },
  [SCAN_STATUS.NOT_REQUIRED]: {
    severity: "ok",
    label: "Scan not required",
    icon: "check",
  },
  [SCAN_STATUS.PENDING]: {
    severity: "muted",
    label: "Not yet scanned",
    icon: "dash",
  },
  [SCAN_STATUS.SCANNING]: {
    severity: "muted",
    label: "Scan in progress",
    icon: "dash",
  },
  [SCAN_STATUS.UNSCANNED]: {
    severity: "muted",
    label: "Not scanned",
    icon: "dash",
  },
  [SCAN_STATUS.FAILED]: {
    severity: "warning",
    label: "Scan could not complete",
    icon: "warning",
  },
  [SCAN_STATUS.INFECTED]: {
    severity: "danger",
    label: "Threat detected",
    icon: "warning",
  },
};

/**
 * True when the value is absent or unrecognized.
 *
 * The column is NOT NULL DEFAULT 'pending', so in practice this only catches
 * pre-migration rows and any future value this build doesn't know about. Both
 * are treated as unremarkable rather than as an error — matching the
 * permissive default the download endpoints apply.
 */
export const isUnknownScanStatus = (status) =>
  !status || !Object.prototype.hasOwnProperty.call(PRESENTATION, status);

export const scanStatusBlocksDownload = (status) => BLOCKING.includes(status);

export const scanStatusNeedsAttention = (status) =>
  NEEDS_ATTENTION.includes(status);

/**
 * Reduce a package's source files to the single worst-off file.
 *
 * Returns that file's whole scan record rather than just its status, so the
 * caller can report when it was scanned and why it was skipped — those
 * details have to come from the same file the status came from.
 *
 * @param {Array} sourceFiles file objects shaped
 *   `{ content: { scanStatus, scannedAt, scanEngine, scanSkipReason } }`
 * @returns {Object|null} `{ status, scannedAt, engine, skipReason }`, or null
 *   when no file carries a recognized status
 */
export const aggregateScanStatus = (sourceFiles = []) => {
  const scanned = sourceFiles.filter(
    (file) => !isUnknownScanStatus(file?.content?.scanStatus)
  );

  if (!scanned.length) {
    return null;
  }

  const worst = SEVERITY.find((status) =>
    scanned.some((file) => file.content.scanStatus === status)
  );

  if (!worst) {
    return null;
  }

  const file = scanned.find((f) => f.content.scanStatus === worst);

  return {
    status: worst,
    scannedAt: file.content.scannedAt || null,
    engine: file.content.scanEngine || null,
    skipReason: file.content.scanSkipReason || null,
  };
};

/**
 * Turn a raw `scan_engine` value into something readable.
 *
 * ClamAV reports as `clamav-<version>`; the tier-3 header validators report
 * their own name (`dicom`, `tiff`, `nifti`).
 */
export const formatScanEngine = (engine) => {
  if (!engine) {
    return "";
  }
  const clamav = engine.match(/^clamav-(.+)$/i);
  if (clamav) {
    return `ClamAV ${clamav[1]}`;
  }
  return engine.toUpperCase();
};

/**
 * Build the renderable form of a scan status.
 *
 * @param {String} status a `files.scan_status` value
 * @param {Object} [detail]
 * @param {String} [detail.skipReason] `scan_skip_reason`
 * @param {String} [detail.engine] `scan_engine`
 * @param {String} [detail.scannedAtLabel] already-formatted `scanned_at`;
 *   formatting stays with the caller so this module has no date dependency
 * @returns {Object|null} null when the status is absent or unrecognized, so
 *   callers can omit the row entirely rather than render a placeholder
 */
export const getScanStatusDisplay = (status, detail = {}) => {
  if (isUnknownScanStatus(status)) {
    return null;
  }

  const base = PRESENTATION[status];
  const engine = formatScanEngine(detail.engine);
  let secondary = "";

  switch (status) {
    case SCAN_STATUS.INFECTED:
      secondary =
        "Download blocked. Do not open or share this file — contact your workspace administrator.";
      break;
    case SCAN_STATUS.FAILED:
      secondary = "Download blocked. Contact Pennsieve support.";
      break;
    case SCAN_STATUS.UNSCANNED:
      // Only mapped copy — scan_skip_reason also carries raw scanner errors.
      secondary = SKIP_REASON_COPY[detail.skipReason] || "";
      break;
    case SCAN_STATUS.CLEAN:
      secondary = [
        detail.scannedAtLabel ? `Scanned ${detail.scannedAtLabel}` : "",
        engine,
      ]
        .filter(Boolean)
        .join(" · ");
      break;
    case SCAN_STATUS.FORMAT_VALIDATED:
      // Distinct from clean on purpose: a header check ran, not an AV scan.
      secondary = engine
        ? `${engine} header verified — not virus-scanned.`
        : "File header verified — not virus-scanned.";
      break;
    default:
      secondary = "";
  }

  return { ...base, status, secondary };
};
