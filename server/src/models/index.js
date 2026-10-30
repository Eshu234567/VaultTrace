const User = require('./User');
const { LostReport, ITEM_CATEGORIES, REPORT_STATUSES } = require('./LostReport');
const { FoundItem, FOUND_STATUSES, RETENTION_CLASSES } = require('./FoundItem');
const MatchCandidate = require('./MatchCandidate');
const { Claim, CLAIM_STATUSES } = require('./Claim');
const Notification = require('./Notification');
const ItemEvent = require('./ItemEvent');
const DisposalRecord = require('./DisposalRecord');
const AuditLog = require('./AuditLog');
const CampusLocation = require('./CampusLocation');

module.exports = {
  User,
  LostReport,
  ITEM_CATEGORIES,
  REPORT_STATUSES,
  FoundItem,
  FOUND_STATUSES,
  RETENTION_CLASSES,
  MatchCandidate,
  Claim,
  CLAIM_STATUSES,
  Notification,
  ItemEvent,
  DisposalRecord,
  AuditLog,
  CampusLocation,
};
