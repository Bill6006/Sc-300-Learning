/* ================= knowledge: concept cards, the question bank, and the SC-300 map ================= */

/* The four skill areas of SC-300 (Microsoft Identity and Access Administrator). */
const AREAS = {
  users: 'Implement and manage user identities',
  auth: 'Implement authentication and access management',
  work: 'Plan and implement workload identities',
  gov: 'Plan and automate identity governance'
};
const STUDY_GUIDE = 'https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/sc-300';
/* What the casebook covers in each area, and what it doesn't (yet). */
const COVERAGE = [
  { area: 'users', covered: ['Microsoft Entra roles and least privilege (case 5)', 'Users, groups and guest accounts, as you meet them in the cases'], gaps: ['Custom domains, tenant settings and administrative units', 'Licenses and dynamic groups', 'External identities: B2B collaboration and cross-tenant access', 'Hybrid identity: Entra Connect Sync, Cloud Sync, password hash sync and pass-through authentication'] },
  { area: 'auth', covered: ['Conditional Access: assignments, network conditions, grant controls (cases 1, 2, 4, 5)', 'Named and trusted locations (case 1)', 'Report-only mode and the What If tool (cases 1, 4)', 'Authentication methods: passkeys (FIDO2), Temporary Access Pass, Authenticator (cases 3, 5)', 'Authentication strengths and phishing-resistant MFA (case 5)', 'Blocking legacy authentication (case 2)', 'Azure role assignments for data access (case 8)'], gaps: ['Self-service password reset and password protection', 'Certificate-based authentication and Windows Hello for Business', 'Session controls, continuous access evaluation and authentication context', 'Microsoft Entra ID Protection: user and sign-in risk policies', 'Global Secure Access'] },
  { area: 'work', covered: ['Enterprise applications from the gallery and SAML single sign-on (case 6)', 'Assignment required, users and groups, app roles (case 7)', 'App registrations, client secrets and service principals (case 8)', 'Managed identities (case 8)'], gaps: ['API permissions, consent and admin consent workflows', 'Application Proxy for on-premises apps', 'App provisioning (SCIM)', 'Microsoft Defender for Cloud Apps'] },
  { area: 'gov', covered: ['Sign-in and audit logs (cases 1, 2, 8)', 'Emergency access accounts (cases 2 to 5)'], gaps: ['Entitlement management: catalogs and access packages', 'Access reviews', 'Privileged Identity Management (PIM)', 'Lifecycle workflows', 'Log Analytics, workbooks and diagnostic settings'] }
];

const TERMS = {
  ca: {
    name: 'Conditional Access policy', area: 'auth',
    plain: 'A rule that runs at sign-in and decides: let them in, ask for more (like MFA), or block.',
    ms: 'Microsoft Entra Conditional Access is Microsoft’s Zero Trust policy engine. Each policy is an if-then statement: if a user wants a resource, then they must meet its controls. Policies are enforced after the first factor (the password) succeeds.',
    portal: 'Entra ID › Conditional Access › Policies',
    exam: 'Every policy that applies must be satisfied, and a block wins.',
    interview: 'Conditional Access is Entra’s policy engine. After the first factor, it looks at who is signing in, from where, on what device and to which app, then blocks, allows, or asks for more, like MFA. I build policies in report-only first and test them with What If.',
    src: ['Conditional Access overview', 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview']
  },
  authn: {
    name: 'Authentication', area: 'auth',
    plain: 'Proving who you are: a password, and maybe a second factor.',
    ms: 'Authentication is the process of proving you are who you say you are, by verifying the identity of a person or device.',
    exam: 'Error 53003 means authentication succeeded and access was refused afterwards.',
    interview: 'Authentication is proving who you are, like a password plus MFA. Authorization is what you’re allowed to reach once we know who you are.',
    src: ['Authentication vs. authorization', 'https://learn.microsoft.com/en-us/entra/identity-platform/authentication-vs-authorization']
  },
  authz: {
    name: 'Authorization', area: 'auth',
    plain: 'Deciding what you’re allowed to reach, once we know who you are.',
    ms: 'Authorization is granting an authenticated party permission to do something: what data they can access and what they can do with it.',
    exam: 'A token isn’t the end: Azure still checks role assignments, and a missing data role gives a 403.',
    interview: 'Authorization is the decision after sign-in. A 53003 error is the cleanest example: the password was right, but the access decision said no.',
    src: ['Authentication vs. authorization', 'https://learn.microsoft.com/en-us/entra/identity-platform/authentication-vs-authorization']
  },
  namedloc: {
    name: 'Named location', area: 'auth',
    plain: 'A labeled list of internet addresses (or countries), like “Brno plant”, that policies can point to.',
    ms: 'Named locations are defined by IP address ranges or by countries and regions. Conditional Access uses them in the network condition to include or exclude where a sign-in comes from, and it only sees the sign-in’s public IP address.',
    portal: 'Entra ID › Conditional Access › Named locations',
    exam: 'A named location matches only the public IP ranges listed in it. CIDR masks must be larger than /8.',
    interview: 'A named location is a set of public IP ranges or countries that Conditional Access can include or exclude. When a site changes ISP, its named location has to change too, or policies stop recognizing the site.',
    src: ['Network conditions and named locations', 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-assignment-network']
  },
  trustedloc: {
    name: 'Trusted location', area: 'auth',
    plain: 'A named location with “trusted” ticked. Policies that say “except trusted locations” then treat every address in it as safe.',
    ms: 'An IP ranges named location marked as trusted. A policy’s network condition can include or exclude “All trusted networks and locations”, which covers every location with that mark.',
    portal: 'Named location › Mark as trusted location',
    exam: 'Trusting a range you no longer own skips MFA for whoever uses it next.',
    interview: 'Marking a location trusted says you control that network. Rules like “MFA outside trusted locations” lean on it, so trusting a range you don’t own quietly removes MFA for whoever does.',
    src: ['Network conditions and named locations', 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-assignment-network']
  },
  mfa: {
    name: 'Multifactor authentication', area: 'auth',
    plain: 'A second proof besides the password, like approving in an app, a code, or a security key.',
    ms: 'Users are asked during sign-in for an extra form of identification. MFA uses two or more of: something you know, something you have, something you are.',
    portal: 'Conditional Access policy › Grant › Require multifactor authentication',
    exam: '“Require MFA” accepts any MFA method the person can use, SMS included.',
    interview: 'MFA is a second factor beyond the password. In Entra I require it through Conditional Access, so I can scope it, exclude the emergency accounts, and test it in report-only first.',
    src: ['How multifactor authentication works', 'https://learn.microsoft.com/en-us/entra/identity/authentication/concept-mfa-howitworks']
  },
  signinlogs: {
    name: 'Sign-in logs', area: 'gov',
    plain: 'The record of every attempt to sign in: who, from where, what happened, and why.',
    ms: 'Microsoft Entra logs every sign-in to the tenant. Each entry shows the user, the client, the resource, the IP address and location, the authentication details and the Conditional Access result.',
    portal: 'Entra ID › Monitoring & health › Sign-in logs',
    exam: 'For access problems, start with the sign-in log: the error code, the IP address and the Conditional Access tab.',
    interview: 'Sign-in logs are my first stop for any access problem: the error code, the IP and location, and the Conditional Access tab tell me which policy decided and why.',
    src: ['Sign-in logs in Microsoft Entra ID', 'https://learn.microsoft.com/en-us/entra/identity/monitoring-health/concept-sign-ins']
  },
  auditlogs: {
    name: 'Audit logs', area: 'gov',
    plain: 'The record of changes: who changed which setting, and when.',
    ms: 'The audit log records changes made in the tenant, such as user and group management and updates to policies, named locations and authentication methods.',
    portal: 'Entra ID › Monitoring & health › Audit logs',
    exam: 'Changes to settings are in the audit log. Attempts to get in are in the sign-in logs.',
    interview: 'When something breaks right after “nothing changed”, the audit log shows who changed what. That’s how you find a Friday-evening edit.',
    src: ['Audit logs in Microsoft Entra ID', 'https://learn.microsoft.com/en-us/entra/identity/monitoring-health/concept-audit-logs']
  },
  reportonly: {
    name: 'Report-only mode', area: 'auth',
    plain: 'A policy that runs and records what it would have done, without enforcing anything.',
    ms: 'A policy state in which Conditional Access evaluates the policy at sign-in but doesn’t enforce it. The results appear in the Report-only tab of each sign-in’s details.',
    portal: 'Conditional Access policy › Enable policy › Report-only',
    exam: 'Report-only results: Success, Failure, User action required, Not applied.',
    interview: 'Report-only shows a policy’s effect on real sign-ins before I enforce it. A “user action required” result for people with no MFA method is exactly the warning you want before switching it on.',
    src: ['Report-only mode', 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-report-only']
  },
  whatif: {
    name: 'What If tool', area: 'auth',
    plain: 'A simulator: describe one sign-in, and it shows which policies apply and what would happen.',
    ms: 'The What If tool evaluates which Conditional Access policies would apply to a user under the conditions you choose (app, IP address, device, client app) and the result.',
    portal: 'Entra ID › Conditional Access › Policies › What If',
    exam: 'What If simulates one sign-in you describe. Report-only records a policy’s verdict on every real sign-in.',
    interview: 'Before I change a policy, I run What If as the people it affects, from where they really sign in. It catches lockouts before users do.',
    src: ['The What If tool', 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/what-if-tool']
  },
  legacy: {
    name: 'Legacy authentication', area: 'auth',
    plain: 'Old sign-in methods that just send a password and can’t do MFA, like a copier’s basic SMTP.',
    ms: 'Sign-ins from older protocols that don’t support multifactor authentication, such as basic authentication over SMTP, POP, IMAP or Exchange ActiveSync. In Conditional Access they’re the “Exchange ActiveSync clients” and “Other clients” client apps.',
    portal: 'Conditional Access policy › Conditions › Client apps',
    exam: 'Block legacy authentication with the Client apps condition: Exchange ActiveSync clients and Other clients.',
    interview: 'Legacy authentication can’t do MFA, so you block it rather than try to protect it. First I find what still uses it in the sign-in logs, like a copier, and move that to modern auth or a relay.',
    src: ['Block legacy authentication', 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-block-legacy-authentication']
  },
  breakglass: {
    name: 'Emergency access account', area: 'gov',
    plain: 'A spare admin account kept for when normal admin sign-in fails.',
    ms: 'Two or more cloud-only Global Administrator accounts, protected with a phishing-resistant method such as a passkey, excluded from Conditional Access policies that could lock them out, and monitored for any use.',
    portal: 'Entra ID › Users (cloud-only accounts on .onmicrosoft.com)',
    exam: 'Exclude emergency access accounts from Conditional Access policies, and protect them with phishing-resistant MFA.',
    interview: 'Emergency access accounts exist for when every admin is locked out, say by a bad policy. They’re cloud-only, use security keys, are excluded from Conditional Access, and any sign-in raises an alert.',
    src: ['Manage emergency access accounts', 'https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/security-emergency-access']
  },
  authmethod: {
    name: 'Authentication methods policy', area: 'auth',
    plain: 'The list of sign-in methods people may register and use, and for which groups.',
    ms: 'The recommended place to manage authentication methods. Admins enable each method, such as Microsoft Authenticator, passkeys (FIDO2) or Temporary Access Pass, for all users or for specific groups.',
    portal: 'Entra ID › Authentication methods › Policies',
    exam: 'The methods policy makes a method available. Conditional Access decides when MFA is required.',
    interview: 'The methods policy controls which methods are available to which groups. It doesn’t make anyone use them; Conditional Access does that, with an authentication strength when the kind of method matters.',
    src: ['Manage authentication methods', 'https://learn.microsoft.com/en-us/entra/identity/authentication/concept-authentication-methods-manage']
  },
  authstrength: {
    name: 'Authentication strength', area: 'auth',
    plain: 'A Conditional Access requirement that says which kinds of MFA count, like “phishing-resistant only”.',
    ms: 'A Conditional Access control that specifies which combinations of authentication methods can satisfy access. The built-in strengths are Multifactor authentication, Passwordless MFA and Phishing-resistant MFA.',
    portal: 'Conditional Access policy › Grant › Require authentication strength',
    exam: '“Require MFA” and “Require authentication strength” can’t be combined in one policy.',
    interview: '“Require MFA” accepts any MFA method the person can use. An authentication strength narrows that, for example to phishing-resistant methods for admins.',
    src: ['Authentication strengths', 'https://learn.microsoft.com/en-us/entra/identity/authentication/concept-authentication-strengths']
  },
  tap: {
    name: 'Temporary Access Pass', area: 'auth',
    plain: 'A time-limited passcode an admin issues so someone can sign in and set up their real methods.',
    ms: 'A time-limited passcode that satisfies strong authentication requirements. It’s used to onboard or recover accounts, including registering passwordless methods, and can be one-time or reusable.',
    portal: 'User › Authentication methods › Add authentication method › Temporary Access Pass',
    exam: 'Lifetime and one-time use are set in the methods policy. A pass for an admin needs a Privileged Authentication Administrator.',
    interview: 'A TAP gets someone with no method yet signed in so they can register one. Keep lifetimes short and passes one-time, or a printed pass becomes a shared password.',
    src: ['Temporary Access Pass', 'https://learn.microsoft.com/en-us/entra/identity/authentication/howto-authentication-temporary-access-pass']
  },
  passkey: {
    name: 'Passkey (FIDO2)', area: 'auth',
    plain: 'A sign-in key that lives on a device, a security key or the Authenticator app, instead of a password.',
    ms: 'A FIDO2 credential based on public-key cryptography, stored on a security key or in Microsoft Authenticator. It counts as phishing-resistant MFA.',
    portal: 'Entra ID › Authentication methods › Policies › Passkey (FIDO2)',
    exam: 'Registering a passkey needs a recent MFA. A Temporary Access Pass counts.',
    interview: 'Passkeys replace the password with a key bound to a device. On shared kiosks where phones aren’t allowed, hardware security keys do the job.',
    src: ['Enable passkeys (FIDO2)', 'https://learn.microsoft.com/en-us/entra/identity/authentication/how-to-enable-passkey-fido2']
  },
  phishres: {
    name: 'Phishing-resistant MFA', area: 'auth',
    plain: 'The strongest kind of MFA: passkeys, Windows Hello for Business, or certificates.',
    ms: 'A built-in authentication strength that only accepts phishing-resistant methods: passkeys (FIDO2), Windows Hello for Business and certificate-based authentication (multifactor).',
    portal: 'Conditional Access policy › Grant › Require authentication strength › Phishing-resistant MFA',
    exam: 'Push notifications and SMS are MFA, but not phishing-resistant.',
    interview: 'For admins I require the phishing-resistant authentication strength, so only passkeys, Windows Hello for Business or certificates satisfy it.',
    src: ['Authentication strengths', 'https://learn.microsoft.com/en-us/entra/identity/authentication/concept-authentication-strengths']
  },
  entraroles: {
    name: 'Microsoft Entra roles', area: 'users',
    plain: 'Built-in admin permissions, like Helpdesk Administrator, given to people who manage the tenant.',
    ms: 'Microsoft Entra built-in roles grant permissions to manage directory resources. Assign the least privileged role that can do the task, and protect every privileged role with strong authentication.',
    portal: 'Entra ID › Roles & admins',
    exam: 'Use the least privileged role for the task. Global Administrator is for emergencies and a few people.',
    interview: 'I give people the narrowest role that does the job, like Helpdesk Administrator for password resets, and I require phishing-resistant MFA for every admin role, not just Global Administrator.',
    src: ['Least privileged roles by task', 'https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/delegate-by-task']
  },
  appreg: {
    name: 'App registration', area: 'work',
    plain: 'An app’s master definition: its ID, its credentials, and the permissions and roles it declares.',
    ms: 'Registering an app creates its application object in its home tenant, with a globally unique application (client) ID. It holds credentials, redirect URIs, API permissions and app roles, and is the template for the app’s service principals.',
    portal: 'Entra ID › App registrations',
    exam: 'Apps your organization builds start in App registrations. Gallery SaaS apps start in Enterprise applications.',
    interview: 'The app registration is the global definition of an app: its client ID, its credentials and the permissions it asks for. Every tenant that uses the app gets a service principal, which you manage as an enterprise application.',
    src: ['Apps and service principals in Microsoft Entra ID', 'https://learn.microsoft.com/en-us/entra/identity-platform/app-objects-and-service-principals']
  },
  entapp: {
    name: 'Enterprise application', area: 'work',
    plain: 'An app’s presence in your tenant: who can sign in, single sign-on, and the rules for its sign-ins.',
    ms: 'Enterprise applications lists the service principals in a tenant. Here you assign users and groups, set properties such as Assignment required, configure single sign-on, and review sign-ins.',
    portal: 'Entra ID › Enterprise apps',
    exam: 'Assignment, single sign-on and user access are set on the enterprise application.',
    interview: 'An enterprise application is the app’s service principal in our tenant. That’s where I assign groups, set Assignment required, configure SAML single sign-on and point Conditional Access at it.',
    src: ['Properties of an enterprise application', 'https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/application-properties']
  },
  sp: {
    name: 'Service principal', area: 'work',
    plain: 'The identity an app uses in your tenant, the way a user account is a person’s.',
    ms: 'The local representation of an application in a tenant: it defines what the app can do there and who can access it. There are three types: application, managed identity and legacy. Their sign-ins are logged separately from users’.',
    portal: 'Monitoring › Sign-in logs › Service principal sign-ins',
    exam: 'An app that signs in as itself appears under service principal sign-ins, not with the people.',
    interview: 'A service principal is an app’s identity in a tenant. When an app signs in as itself with a secret or certificate, it shows up in the service principal sign-in logs.',
    src: ['Apps and service principals in Microsoft Entra ID', 'https://learn.microsoft.com/en-us/entra/identity-platform/app-objects-and-service-principals']
  },
  mi: {
    name: 'Managed identity', area: 'work',
    plain: 'An identity Azure gives a resource, like a VM, with credentials Azure manages. No secret to store or renew.',
    ms: 'A special type of service principal for Azure resources. A system-assigned identity is created with one resource and deleted with it; a user-assigned identity is its own Azure resource and can be attached to several.',
    portal: 'Azure resource › Identity',
    exam: 'System-assigned: one resource, same lifecycle. User-assigned: standalone, shareable.',
    interview: 'If the code runs in Azure, I give the resource a managed identity instead of an app secret: there’s no credential to leak or let expire. Then I grant that identity an Azure role on exactly what it needs.',
    src: ['Managed identities for Azure resources', 'https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview']
  },
  secret: {
    name: 'Client secret', area: 'work',
    plain: 'A password for an app. It expires, and whoever has it can sign in as the app.',
    ms: 'A credential on an app registration that the app presents with its client ID to get tokens. The portal allows up to 24 months, Microsoft recommends less than 12, and the value is shown only once.',
    portal: 'App registrations › Certificates & secrets',
    exam: 'An expired secret fails with AADSTS7000222. Prefer certificates or managed identities.',
    interview: 'A client secret is an app password with an expiry date. I track expiries, keep lifetimes short, and prefer certificates or managed identities, so nothing breaks at midnight on a Sunday.',
    src: ['Add and manage app credentials', 'https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials']
  },
  sso: {
    name: 'SAML single sign-on', area: 'work',
    plain: 'Signing in to another company’s app with your Tallis account, because Entra vouches for you.',
    ms: 'Entra issues a signed SAML token to the application. In the Basic SAML Configuration, the Identifier (Entity ID) names the application and the Reply URL (Assertion Consumer Service URL) is where Entra sends the token.',
    portal: 'Enterprise apps › app › Single sign-on › SAML',
    exam: 'AADSTS50011: reply URL mismatch. AADSTS700016: identifier not found. AADSTS50105: user not assigned.',
    interview: 'For SAML I enter the Identifier and Reply URL exactly as the vendor gives them, send them our federation metadata, assign groups, then test with a real user.',
    src: ['Enable SAML single sign-on for an enterprise application', 'https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/add-application-portal-setup-sso']
  },
  assignreq: {
    name: 'Assignment required', area: 'work',
    plain: 'A switch on an app. Yes means only people you assign can sign in. No means anyone in the tenant can.',
    ms: 'An enterprise application property. When Yes, users and other applications must be assigned to the application before they can get a token. When No, all users can sign in.',
    portal: 'Enterprise apps › app › Properties',
    exam: 'Assigning groups doesn’t limit access unless Assignment required is Yes.',
    interview: 'Assignment required is the difference between “Sales can use this” and “anyone with a Tallis account can”. I set it to Yes and assign groups, not individuals.',
    src: ['Properties of an enterprise application', 'https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/application-properties']
  },
  approle: {
    name: 'App role', area: 'work',
    plain: 'A permission level the app itself defines, like User or Manager, that you hand out when you assign people.',
    ms: 'App roles are declared on the app registration. Admins assign them to users and groups under the enterprise application’s Users and groups, and the app receives them in the token’s roles claim.',
    portal: 'Enterprise apps › app › Users and groups › Add assignment › Select a role',
    exam: 'App roles decide what people can do inside the app. Assignment decides who gets in at all.',
    interview: 'App roles are defined by the app; I decide who gets which. Assigning the Manager role is how the app knows Ben can see the whole pipeline.',
    src: ['Add app roles and get them from a token', 'https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-app-roles-in-apps']
  },
  rbac: {
    name: 'Azure role assignment', area: 'auth',
    plain: 'Permission on an Azure resource, like a storage account, given to a person or an app’s identity.',
    ms: 'A role assignment attaches a role definition, such as Storage Blob Data Contributor, to a security principal (user, group, service principal or managed identity) at a scope (management group, subscription, resource group or resource).',
    portal: 'Azure resource › Access control (IAM)',
    exam: 'Owner and Contributor manage the account. Storage Blob Data roles open the data.',
    interview: 'Getting a token is authentication. The storage account still checks Azure roles, so an identity without a data role gets a 403, which is an authorization failure.',
    src: ['Assign an Azure role for access to blob data', 'https://learn.microsoft.com/en-us/azure/storage/blobs/assign-azure-role-data-access']
  }
};

/* Questions. kind 'pair' tells two ideas apart; kind 'exam' is in the style of SC-300 items.
   opts: [key, label]; a: the right key; why: the explanation shown after answering. */
const QUESTIONS = [
  /* ----- telling pairs apart ----- */
  { id: 'p-authn-authz', kind: 'pair', terms: ['authn', 'authz'], q: 'The floor sees “Your sign-in was successful, but it doesn’t meet the criteria to access this resource.” Which part failed?', opts: [['authn', 'Authentication: proving who they are'], ['authz', 'Authorization: being allowed in']], a: 'authz', why: 'Their passwords worked. The access decision, made by Conditional Access, said no.' },
  { id: 'p-named-trusted', kind: 'pair', terms: ['namedloc', 'trustedloc'], q: 'You add a named location for a supplier’s office and leave “Mark as trusted” off. A policy requires MFA except from all trusted locations. Is someone signing in from that office asked for MFA?', opts: [['yes', 'Yes, they’re asked for MFA'], ['no', 'No, they skip MFA']], a: 'yes', why: 'Being a named location isn’t enough. Only locations marked trusted count as “all trusted locations”.' },
  { id: 'p-audit-signin', kind: 'pair', terms: ['auditlogs', 'signinlogs'], q: 'Who changed a named location on Friday evening? Where do you look?', opts: [['signinlogs', 'The sign-in logs'], ['auditlogs', 'The audit log']], a: 'auditlogs', why: 'Changes to settings are in the audit log. The sign-in logs record attempts to get in.' },
  { id: 'p-ro-whatif', kind: 'pair', terms: ['reportonly', 'whatif'], q: 'You want to see what a new policy would have done to everyone’s real sign-ins for a week, without enforcing it. Which do you use?', opts: [['reportonly', 'Report-only mode'], ['whatif', 'The What If tool']], a: 'reportonly', why: 'What If simulates one sign-in you describe. Report-only records the policy’s verdict on every real sign-in.' },
  { id: 'p-method-strength', kind: 'pair', terms: ['authmethod', 'authstrength'], q: 'You want admins to be able to sign in only with passkeys. Which setting makes that a requirement?', opts: [['authmethod', 'The authentication methods policy'], ['authstrength', 'An authentication strength in a Conditional Access policy']], a: 'authstrength', why: 'The methods policy makes passkeys available. A Conditional Access policy that requires the phishing-resistant strength makes them required.' },
  { id: 'p-strength-mfa', kind: 'pair', terms: ['authstrength', 'mfa'], q: 'A policy grants access with “Require multifactor authentication”. Does an SMS code satisfy it, if SMS is enabled for that person?', opts: [['yes', 'Yes'], ['no', 'No']], a: 'yes', why: '“Require MFA” accepts any MFA method the person can use. To rule out SMS you’d require an authentication strength instead.' },
  { id: 'p-method-ca', kind: 'pair', terms: ['authmethod', 'ca'], q: 'Passkeys are enabled for the floor in the authentication methods policy. Does anyone on the floor now have to use one?', opts: [['yes', 'Yes, they must'], ['no', 'No, they only may']], a: 'no', why: 'The methods policy makes a method available. A Conditional Access policy decides when MFA is required.' },
  { id: 'p-mfa-phish', kind: 'pair', terms: ['mfa', 'phishres'], q: 'An admin approves sign-ins with a push notification in Microsoft Authenticator. Does that meet the phishing-resistant strength?', opts: [['yes', 'Yes'], ['no', 'No']], a: 'no', why: 'Push approval is MFA, but not phishing-resistant. That strength accepts passkeys, Windows Hello for Business and certificates.' },
  { id: 'p-passkey-phish', kind: 'pair', terms: ['passkey', 'phishres'], q: 'Is a passkey in Microsoft Authenticator accepted by the phishing-resistant strength?', opts: [['yes', 'Yes'], ['no', 'No']], a: 'yes', why: 'Passkeys, on a security key or in Authenticator, are phishing-resistant methods.' },
  { id: 'p-appreg-entapp', kind: 'pair', terms: ['appreg', 'entapp'], q: 'You need a SaaS app to require assignment at your company. Where do you set that?', opts: [['appreg', 'App registrations'], ['entapp', 'Enterprise applications']], a: 'entapp', why: 'Assignment, single sign-on and sign-in settings belong to the enterprise application, the app’s service principal in your tenant.' },
  { id: 'p-mi-sp', kind: 'pair', terms: ['mi', 'sp'], q: 'A nightly job runs on an Azure VM. Which identity means nobody ever renews a secret for it?', opts: [['sp', 'Its own app registration’s service principal, with a client secret'], ['mi', 'A managed identity on the VM']], a: 'mi', why: 'A managed identity is a service principal whose credentials Azure manages. An app registration’s secret has to be renewed by someone.' },
  { id: 'p-mi-secret', kind: 'pair', terms: ['mi', 'secret'], q: 'Which one can expire at 23:59 on a Sunday and stop a nightly job?', opts: [['secret', 'A client secret'], ['mi', 'A managed identity']], a: 'secret', why: 'Client secrets have an expiry date. A managed identity’s credentials are handled by Azure.' },
  { id: 'p-approle-assignreq', kind: 'pair', terms: ['approle', 'assignreq'], q: 'Ben must see the whole pipeline in the CRM, Jordan only his own deals. What decides that?', opts: [['assignreq', 'Assignment required'], ['approle', 'The app role each is assigned']], a: 'approle', why: 'Assignment required decides who can sign in at all. App roles decide what each person can do inside the app.' },
  { id: 'p-authz-rbac', kind: 'pair', terms: ['authz', 'rbac'], q: 'A VM’s managed identity gets a token, but the storage account answers 403. Which part failed?', opts: [['authn', 'Authentication'], ['authz', 'Authorization']], a: 'authz', why: 'The token proves who it is. The storage account then checks Azure role assignments, and the identity has no data role there.' },

  /* ----- in the style of the exam ----- */
  { id: 'q-isp-change', kind: 'exam', terms: ['namedloc', 'ca'], q: 'A branch office changes ISP. Its users are now blocked by a Conditional Access policy that blocks access from outside the branch network, and the sign-in logs show error 53003. What should you update?', opts: [['a', 'The policy’s grant controls'], ['b', 'The branch’s named location, with the new public IP range'], ['c', 'The users’ authentication methods'], ['d', 'Microsoft Entra Connect']], a: 'b', why: 'The policy still works. It just doesn’t recognize the branch, because Conditional Access only sees the public IP address.' },
  { id: 'q-53003', kind: 'exam', terms: ['authn', 'authz', 'signinlogs'], q: 'A user enters the correct password and receives error 53003. Which statement is true?', opts: [['a', 'Authentication failed'], ['b', 'Authentication succeeded, and a Conditional Access policy blocked access'], ['c', 'The account is disabled'], ['d', 'The user must register for MFA']], a: 'b', why: '53003 is a Conditional Access block. A wrong password is 50126 and a disabled account is 50057.' },
  { id: 'q-cidr', kind: 'exam', terms: ['namedloc'], q: 'An ISP assigns your site 203.0.113.80/28. Which addresses does that range cover?', opts: [['a', '203.0.113.80 to 203.0.113.95 (16 addresses)'], ['b', '203.0.113.80 to 203.0.113.108 (28 addresses)'], ['c', '203.0.113.80 to 203.0.113.87 (8 addresses)'], ['d', '203.0.113.0 to 203.0.113.255']], a: 'a', why: 'A /28 leaves 4 bits for addresses: 2⁴ = 16, from .80 to .95.' },
  { id: 'q-kovo', kind: 'exam', terms: ['trustedloc', 'namedloc'], q: 'A trusted named location contains 203.0.113.64/28. A policy requires MFA for all users, excluding all trusted locations. A user signs in from 203.0.113.70. What happens?', opts: [['a', 'The user is asked for MFA'], ['b', 'The user signs in without MFA'], ['c', 'The sign-in is blocked'], ['d', 'It depends on the device']], a: 'b', why: '203.0.113.64/28 covers .64 to .79, so .70 is inside a trusted location and the policy doesn’t apply.' },
  { id: 'q-home', kind: 'exam', terms: ['ca', 'namedloc'], q: 'A group is excluded from a policy that requires MFA outside trusted locations. A second policy blocks that group everywhere except one named location. A member signs in from a home IP address that isn’t in any named location. What happens?', opts: [['a', 'They’re asked for MFA'], ['b', 'They’re blocked'], ['c', 'They sign in with just a password']], a: 'b', why: 'The second policy applies (home isn’t the excluded location) and its grant is Block access. A block wins.' },
  { id: 'q-legacy-cond', kind: 'exam', terms: ['legacy'], q: 'Which Conditional Access condition do you use to block legacy authentication?', opts: [['a', 'Device platforms'], ['b', 'Client apps: Exchange ActiveSync clients and Other clients'], ['c', 'Sign-in risk'], ['d', 'Locations']], a: 'b', why: 'Legacy protocols show up as the Exchange ActiveSync and Other clients client apps.' },
  { id: 'q-mfp', kind: 'exam', terms: ['legacy'], q: 'A multifunction printer sends scans with SMTP basic authentication, and a policy blocks legacy authentication for all users. What should you do?', opts: [['a', 'Exclude the printer’s account from the policy'], ['b', 'Exclude the office’s IP range from the policy'], ['c', 'Keep the block, and send the printer’s mail through an SMTP relay or upgrade it to modern authentication'], ['d', 'Switch the policy to report-only']], a: 'c', why: 'Every exclusion is a password-only door. A relay connector means the printer doesn’t sign in at all.' },
  { id: 'q-block-wins', kind: 'exam', terms: ['ca'], q: 'Two Conditional Access policies apply to a sign-in. One requires MFA, the other blocks access. What happens?', opts: [['a', 'The user completes MFA and gets in'], ['b', 'Access is blocked'], ['c', 'The older policy wins'], ['d', 'The user chooses']], a: 'b', why: 'Every policy that applies must be satisfied, and nothing can satisfy Block access.' },
  { id: 'q-tap-onboard', kind: 'exam', terms: ['tap', 'passkey'], q: 'Frontline workers have no authentication methods registered and must register FIDO2 security keys at a shared kiosk. What should you issue so they can sign in to register?', opts: [['a', 'A Temporary Access Pass'], ['b', 'An SMS code'], ['c', 'A new password'], ['d', 'An app password']], a: 'a', why: 'A Temporary Access Pass satisfies strong authentication for a short time, which is what registering a passkey needs.' },
  { id: 'q-methods-policy', kind: 'exam', terms: ['authmethod'], q: 'You enable Passkey (FIDO2) for a group in the authentication methods policy. What does that do?', opts: [['a', 'Requires the group to use passkeys at every sign-in'], ['b', 'Allows the group to register and use passkeys'], ['c', 'Disables their other methods'], ['d', 'Registers passkeys for them']], a: 'b', why: 'The methods policy makes a method available. Requiring it is Conditional Access’s job.' },
  { id: 'q-tap-onetime', kind: 'exam', terms: ['tap'], q: 'You need every Temporary Access Pass to work only once. Where do you configure that?', opts: [['a', 'In a Conditional Access policy'], ['b', 'In the authentication methods policy, under Temporary Access Pass'], ['c', 'In self-service password reset'], ['d', 'On each user’s profile']], a: 'b', why: 'Lifetime limits and one-time use are settings of the Temporary Access Pass method.' },
  { id: 'q-reportonly', kind: 'exam', terms: ['reportonly'], q: 'You want to measure a new Conditional Access policy’s impact on all users for a week without enforcing it. What should you do?', opts: [['a', 'Run the What If tool'], ['b', 'Set the policy to Report-only'], ['c', 'Set it to Off and read the audit log'], ['d', 'Assign it to a test group']], a: 'b', why: 'Report-only evaluates the policy on every real sign-in and logs the result without enforcing it.' },
  { id: 'q-whatif', kind: 'exam', terms: ['whatif'], q: 'Before enabling a policy, you need to know which policies would apply to one user signing in to Teams from a specific IP address. What should you use?', opts: [['a', 'The What If tool'], ['b', 'Report-only mode'], ['c', 'Access reviews'], ['d', 'The audit log']], a: 'a', why: 'What If takes a user, an app, an IP address and device details, and shows which policies would apply.' },
  { id: 'q-exclude-bg', kind: 'exam', terms: ['breakglass', 'ca'], q: 'You create a policy from the “Require multifactor authentication for all users” template. Which accounts should it exclude?', opts: [['a', 'All administrators'], ['b', 'Your emergency access accounts'], ['c', 'Guests'], ['d', 'Nobody']], a: 'b', why: 'If a policy ever locks every admin out, the emergency access accounts are how you get back in.' },
  { id: 'q-ro-result', kind: 'exam', terms: ['reportonly'], q: 'A report-only policy that requires MFA shows “Report-only: User action required” for a user. What does that mean?', opts: [['a', 'The user was blocked'], ['b', 'Had the policy been on, the user would have had to complete MFA'], ['c', 'The user completed MFA'], ['d', 'The policy didn’t apply']], a: 'b', why: 'Report-only never enforces. “User action required” means enforcing it would have prompted the user.' },
  { id: 'q-authstrength', kind: 'exam', terms: ['authstrength', 'phishres'], q: 'Administrators must sign in only with phishing-resistant methods. Which grant control should you use?', opts: [['a', 'Require multifactor authentication'], ['b', 'Require authentication strength: Phishing-resistant MFA'], ['c', 'Require device to be marked as compliant'], ['d', 'Require approved client app']], a: 'b', why: 'An authentication strength narrows which methods count. Plain “Require MFA” accepts any method.' },
  { id: 'q-phish-method', kind: 'exam', terms: ['phishres', 'passkey'], q: 'Which method satisfies the Phishing-resistant MFA authentication strength?', opts: [['a', 'Push notification in Microsoft Authenticator'], ['b', 'SMS code'], ['c', 'A passkey on a FIDO2 security key'], ['d', 'Voice call']], a: 'c', why: 'Passkeys, Windows Hello for Business and certificate-based authentication are phishing-resistant.' },
  { id: 'q-breakglass', kind: 'exam', terms: ['breakglass'], q: 'Which setup follows Microsoft’s guidance for emergency access accounts?', opts: [['a', 'Synced from on-premises AD and protected with SMS'], ['b', 'Cloud-only on the .onmicrosoft.com domain, Global Administrator, protected with a passkey, and excluded from Conditional Access'], ['c', 'Assigned to one person who uses it daily'], ['d', 'A long password and no MFA']], a: 'b', why: 'They must work when everything else fails, so they don’t depend on sync or on one person, and they use phishing-resistant MFA.' },
  { id: 'q-least-priv', kind: 'exam', terms: ['entraroles'], q: 'A support technician needs to reset passwords for non-admin users. Which role should you assign?', opts: [['a', 'Global Administrator'], ['b', 'Helpdesk Administrator'], ['c', 'Security Administrator'], ['d', 'Conditional Access Administrator']], a: 'b', why: 'Of these, Helpdesk Administrator is the narrowest role that can reset passwords for non-administrators. The others are broader or unrelated. Password Administrator is narrower still, if resets are all they do.' },
  { id: 'q-gallery', kind: 'exam', terms: ['entapp', 'sso'], q: 'You need SAML single sign-on for a SaaS app that is in the Microsoft Entra gallery. Where do you add it?', opts: [['a', 'App registrations › New registration'], ['b', 'Enterprise applications › New application › the gallery'], ['c', 'Conditional Access › Target resources'], ['d', 'Azure portal › Resource groups']], a: 'b', why: 'Gallery apps are added as enterprise applications, with their SAML template ready to fill in.' },
  { id: 'q-50011', kind: 'exam', terms: ['sso'], q: 'Users get AADSTS50011 when they sign in to a SAML app. What is the most likely cause?', opts: [['a', 'They aren’t assigned to the app'], ['b', 'The Reply URL (Assertion Consumer Service URL) doesn’t match'], ['c', 'Their accounts are disabled'], ['d', 'MFA is required']], a: 'b', why: '50011 is a reply URL mismatch. Not being assigned is 50105.' },
  { id: 'q-50105', kind: 'exam', terms: ['assignreq'], q: 'People outside Sales get AADSTS50105 when they open the CRM. What causes this?', opts: [['a', 'Assignment required is Yes and they aren’t assigned'], ['b', 'The SAML certificate expired'], ['c', 'Conditional Access blocked them'], ['d', 'The Reply URL is wrong']], a: 'a', why: '50105 means the user signed in but isn’t assigned to an app that requires assignment.' },
  { id: 'q-assignreq', kind: 'exam', terms: ['assignreq'], q: 'You assigned the Sales group to an enterprise application, but every employee can still sign in. What should you change?', opts: [['a', 'Set Assignment required to Yes'], ['b', 'Set Visible to users to No'], ['c', 'Remove the app roles'], ['d', 'Require MFA for the app']], a: 'a', why: 'With Assignment required on No, assignments only decide roles and what shows in My Apps, not who can sign in.' },
  { id: 'q-approle', kind: 'exam', terms: ['approle'], q: 'Managers must see every record in an app, and other users only their own. The app defines User and Manager roles. What should you do?', opts: [['a', 'Create two Conditional Access policies'], ['b', 'Assign users and groups to the app with the right app role'], ['c', 'Add API permissions'], ['d', 'Create two enterprise applications']], a: 'b', why: 'App roles are assigned on the enterprise application and arrive in the token for the app to use.' },
  { id: 'q-7000222', kind: 'exam', terms: ['secret'], q: 'An app authenticates with a client secret that expired last night. What happens when it requests a token?', opts: [['a', 'It keeps working for 30 days'], ['b', 'The request fails with AADSTS7000222'], ['c', 'Users get AADSTS50105'], ['d', 'The secret renews automatically']], a: 'b', why: 'An expired secret stops working immediately. Nothing renews it.' },
  { id: 'q-mi', kind: 'exam', terms: ['mi', 'rbac'], q: 'A script on an Azure VM must write to a storage account without storing credentials. What should you use?', opts: [['a', 'A client secret in a config file'], ['b', 'A managed identity on the VM, with an Azure role on the storage account'], ['c', 'A user account with a password'], ['d', 'The storage account key in the script']], a: 'b', why: 'The managed identity gets tokens with no secret to store, and the role assignment authorizes the writes.' },
  { id: 'q-rbac403', kind: 'exam', terms: ['rbac', 'authz'], q: 'A managed identity has Contributor on a storage account and gets 403 when it writes a blob with Microsoft Entra authentication. What should you assign?', opts: [['a', 'Owner'], ['b', 'Storage Blob Data Contributor'], ['c', 'Reader'], ['d', 'Storage Account Contributor']], a: 'b', why: 'Contributor and Owner manage the account. Writing data with Entra authentication needs a Storage Blob Data role.' },
  { id: 'q-secret-life', kind: 'exam', terms: ['secret'], q: 'What does Microsoft recommend for client secret lifetimes?', opts: [['a', 'The maximum, 24 months'], ['b', 'Less than 12 months, and certificates or managed identities where possible'], ['c', 'No expiry'], ['d', 'Exactly 90 days']], a: 'b', why: 'Shorter lifetimes shrink the window if a secret leaks, and managed identities remove the secret altogether.' },
  { id: 'q-mi-system', kind: 'exam', terms: ['mi'], q: 'Which statement about a system-assigned managed identity is true?', opts: [['a', 'Several resources can share it'], ['b', 'It’s deleted when its Azure resource is deleted'], ['c', 'It needs a client secret'], ['d', 'It’s created in App registrations']], a: 'b', why: 'A system-assigned identity lives and dies with its resource. A user-assigned identity is the shareable kind.' }
];
const QMAP = {};
QUESTIONS.forEach(q => { QMAP[q.id] = q; });
