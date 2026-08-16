import DashboardLayout from '../components/DashboardLayout.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';

const S = {
    wrap: { fontSize: 11.5, lineHeight: 1.75, color: 'var(--text-secondary)', maxWidth: 720, margin: '0 auto' },
    h1: { fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 },
    updated: { fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 24, paddingBottom: 14, borderBottom: '1px solid var(--border-color)' },
    h2: { fontSize: 13, fontWeight: 700, color: 'var(--color-gold)', marginTop: 28, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' },
    h3: { fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginTop: 16, marginBottom: 4 },
    p: { marginBottom: 10 },
    ul: { paddingLeft: 18, marginBottom: 10 },
    li: { marginBottom: 5 },
    highlight: { background: 'rgba(229,184,74,0.06)', border: '1px solid rgba(229,184,74,0.12)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 11 },
};

export default function Terms() {
    const { translate } = useLanguage();

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <div style={S.wrap}>
                        <h1 style={S.h1}>Terms &amp; Conditions</h1>
                        <p style={S.updated}>Last Updated: August 16, 2026 &nbsp;|&nbsp; Version 4.2 &nbsp;|&nbsp; NEWHOPE Platform</p>

                        <div style={S.highlight}>
                            <strong>IMPORTANT NOTICE:</strong> Please read these Terms &amp; Conditions ("Terms") carefully before using the NEWHOPE platform. By registering, accessing, or using any part of the NEWHOPE platform, you acknowledge that you have read, understood, and agree to be bound by these Terms and all applicable laws and regulations. If you do not agree with any part of these Terms, you must not use the platform.
                        </div>

                        {/* 1 */}
                        <h2 style={S.h2}>1. Introduction &amp; Platform Overview</h2>
                        <p style={S.p}>NEWHOPE is a digital earning and social commerce platform that enables registered users to earn rewards by completing tasks, watching sponsored video content, referring others to the platform, participating in community activities, depositing into their shop balance, and withdrawing accumulated earnings through supported payment methods. The platform operates across multiple countries in Africa and beyond, supporting local currencies including Tanzanian Shilling (TZS), Kenyan Shilling (KES), Ugandan Shilling (UGX), Rwandan Franc (RWF), Burundian Franc (BIF), Mozambican Metical (MZN), and other supported currencies.</p>
                        <p style={S.p}>The platform is owned and operated by NEWHOPE DIGITAL VENTURES. The software, infrastructure, and content of the platform are proprietary and are protected under applicable intellectual property laws. These Terms govern your relationship with NEWHOPE and apply to all users, regardless of country, device, or method of access.</p>
                        <p style={S.p}>NEWHOPE reserves the right to modify, suspend, or discontinue any aspect of the platform at any time without prior notice. We are not liable to you or any third party for any modification, suspension, or discontinuation of services. Continued use of the platform after changes constitutes acceptance of the updated Terms.</p>

                        {/* 2 */}
                        <h2 style={S.h2}>2. Eligibility &amp; Account Registration</h2>
                        <h3 style={S.h3}>2.1 Age Requirement</h3>
                        <p style={S.p}>You must be at least 18 years of age to register for and use the NEWHOPE platform. By creating an account, you confirm that you are 18 years of age or older. If we discover that an account was created by a person under the age of 18, we reserve the right to immediately suspend or permanently terminate the account and forfeit all accumulated balances without notice or compensation.</p>

                        <h3 style={S.h3}>2.2 Account Creation</h3>
                        <p style={S.p}>To use the NEWHOPE platform, you must create an account by providing the following information:</p>
                        <ul style={S.ul}>
                            <li style={S.li}>A unique username consisting only of alphanumeric characters (letters and numbers, no spaces or special characters)</li>
                            <li style={S.li}>A valid, personal email address that you own and control</li>
                            <li style={S.li}>A strong password of at least 8 characters</li>
                            <li style={S.li}>Your country of residence (used to determine applicable currency and payment methods)</li>
                            <li style={S.li}>A valid mobile phone number for the country you select, adhering to the country-specific format requirements</li>
                        </ul>
                        <p style={S.p}>You agree to provide accurate, complete, and current information at the time of registration. You must update your information promptly if it changes. NEWHOPE shall not be liable for any issues arising from inaccurate or outdated information provided by you.</p>

                        <h3 style={S.h3}>2.3 One Account Per Person</h3>
                        <p style={S.p}>Each user is permitted to operate only one account on the NEWHOPE platform. Owning, operating, or having access to multiple accounts (whether through the same or different devices, IP addresses, email addresses, phone numbers, or individuals in the same household) constitutes a violation of these Terms and may result in the permanent termination of all associated accounts. Any balances in violating accounts will be forfeited in full with no recourse. We use advanced detection systems including IP tracking, device fingerprinting, behavioral analysis, and referral network mapping to identify duplicate accounts.</p>

                        <h3 style={S.h3}>2.4 Account Security</h3>
                        <p style={S.p}>You are solely responsible for maintaining the confidentiality of your login credentials, including your email and password. You agree not to share your account credentials with any other person. You are fully responsible for all activities that occur under your account. If you suspect unauthorized access to your account, you must notify NEWHOPE immediately. NEWHOPE shall not be liable for any loss or damage arising from unauthorized use of your account resulting from your failure to keep your credentials secure.</p>

                        {/* 3 */}
                        <h2 style={S.h2}>3. Account Activation</h2>
                        <p style={S.p}>Upon registration, your account will be in an unactivated state. To access the full range of earning features, including task completion, referral commissions, withdrawals, and shop balance, you must complete the activation process by making a one-time activation payment.</p>
                        <p style={S.p}>The activation fee varies by country and currency, as determined by NEWHOPE based on local market conditions. The applicable activation fee will be clearly displayed during the activation process. Activation fees are non-refundable under any circumstances, including but not limited to account suspension, voluntary account closure, platform discontinuation, or dissatisfaction with the platform.</p>
                        <p style={S.p}>Activation payments can be made through the following methods, where available:</p>
                        <ul style={S.ul}>
                            <li style={S.li}><strong>PalmPesa (Automatic):</strong> For Tanzanian users, the platform integrates with PalmPesa to provide seamless automatic mobile money payment initiation. The payment request is sent directly to your registered mobile number. You must approve the payment via your mobile money PIN within the allotted time window (typically 2–5 minutes). NEWHOPE is not responsible for any delays, timeouts, or failures caused by network issues or user error.</li>
                            <li style={S.li}><strong>Manual Payment:</strong> For users in countries where automatic payment is not supported, or as an alternative, you may manually send the activation amount via the specified local mobile money number or other payment channel displayed in the app. After sending, you must enter your transaction ID/reference into the app for admin verification. Manual activation may take up to 24 hours to be confirmed.</li>
                        </ul>
                        <p style={S.p}>NEWHOPE reserves the right to reject any activation payment that cannot be verified, appears fraudulent, or does not match the required activation amount. In such cases, the user will be notified and may be asked to resubmit with correct information. Activation status is final once confirmed by an administrator and cannot be reversed.</p>

                        {/* 4 */}
                        <h2 style={S.h2}>4. Earning System &amp; Task Completion</h2>
                        <h3 style={S.h3}>4.1 Task Categories</h3>
                        <p style={S.p}>The NEWHOPE platform offers multiple categories of tasks through which users can earn rewards. These task categories include, but are not limited to:</p>
                        <ul style={S.ul}>
                            <li style={S.li}><strong>YouTube Video Tasks:</strong> Watch sponsored or partner video content for a minimum required duration (typically 15–30 seconds). Earnings are automatically credited upon confirmed completion of the watch timer. The earning amount per video is set by the administrator based on country and currency, and may change at any time.</li>
                            <li style={S.li}><strong>TikTok Tasks:</strong> Complete actions on TikTok as specified in the task description. This may include watching a video, visiting a profile, or engaging with content as directed.</li>
                            <li style={S.li}><strong>Facebook Tasks:</strong> Perform designated actions on the Facebook platform such as visiting a page, watching a video, or liking specified content.</li>
                            <li style={S.li}><strong>Instagram Tasks:</strong> Follow accounts, view stories/reels, or engage with Instagram content as specified in the task.</li>
                            <li style={S.li}><strong>Twitter / X Tasks:</strong> Engage with Twitter/X content as directed, including viewing posts, following accounts, or retweeting designated content.</li>
                            <li style={S.li}><strong>Telegram Tasks:</strong> Join specified Telegram groups or channels, view content, or perform other specified actions.</li>
                            <li style={S.li}><strong>WhatsApp Tasks:</strong> Join WhatsApp Business groups or channels as specified.</li>
                            <li style={S.li}><strong>Shop Tasks:</strong> Complete product reviews, visit online stores, or engage with e-commerce content.</li>
                            <li style={S.li}><strong>Survey Tasks:</strong> Complete opinion surveys or questionnaires as designated by the platform or its brand partners.</li>
                            <li style={S.li}><strong>Registration Tasks:</strong> Register on partner websites or applications as specified.</li>
                        </ul>

                        <h3 style={S.h3}>4.2 Task Availability &amp; Scheduling</h3>
                        <p style={S.p}>Tasks are made available on a scheduled basis and may be subject to daily limits, time-based unlocking, or consecutive-day eligibility requirements. Some tasks may only be available to users who have maintained a "perfect day record," meaning they have completed required tasks on each consecutive calendar day without missing a single day. Eligibility for such tasks is evaluated using coordinated universal time (UTC) and East Africa Time (EAT, UTC+3) to prevent timezone manipulation by users attempting to gain unfair access.</p>
                        <p style={S.p}>NEWHOPE uses server-side time verification for all task scheduling and eligibility computations. Any attempt by a user to manipulate their device's time zone settings, system clock, or VPN configuration to gain unauthorized access to locked tasks or to claim bonus days falsely will be treated as fraudulent activity and may result in account termination.</p>

                        <h3 style={S.h3}>4.3 Task Earnings</h3>
                        <p style={S.p}>The earning amount for each task is denominated in the user's local currency and is configured by administrators for each country separately. Task earnings are credited automatically to the user's task-specific balance (e.g., YouTube Balance, TikTok Balance) immediately upon verified task completion. These balances are shown on the Wallet page under "Task Earnings."</p>
                        <p style={S.p}>Task earnings are not equivalent to or interchangeable with the user's main balance or shop balance unless explicitly specified in a promotional campaign. Task balances are transferred to the main balance upon meeting minimum thresholds and following platform-defined procedures. Earnings may accumulate over time and are subject to the withdrawal policies outlined in Section 6.</p>

                        <h3 style={S.h3}>4.4 Task Verification &amp; Anti-Fraud</h3>
                        <p style={S.p}>NEWHOPE employs multiple layers of verification to ensure that tasks are being genuinely completed and not being gamed, automated, or abused. These verification methods include:</p>
                        <ul style={S.ul}>
                            <li style={S.li}>Server-side timers that cannot be manipulated by the client browser or app</li>
                            <li style={S.li}>IP address and device fingerprint tracking to prevent automated script-based task submission</li>
                            <li style={S.li}>Rate limiting on task submissions per user per day</li>
                            <li style={S.li}>Behavioral analysis to detect patterns consistent with bot behavior</li>
                            <li style={S.li}>Random manual review of task completions by administrators</li>
                        </ul>
                        <p style={S.p}>If a user is found to be completing tasks through automated means, bots, scripts, click farms, or any other non-genuine method, their account will be permanently suspended and all earnings forfeited. NEWHOPE reserves the right to reverse any credits it determines were fraudulently obtained.</p>

                        {/* 5 */}
                        <h2 style={S.h2}>5. Referral &amp; Affiliate Program</h2>
                        <h3 style={S.h3}>5.1 How the Referral System Works</h3>
                        <p style={S.p}>NEWHOPE operates a multi-level affiliate referral program. Each registered user receives a unique referral code and link, which can be shared with others. When a new user registers using your referral code and subsequently completes account activation, you earn a referral commission. The commission structure is multi-tiered:</p>
                        <ul style={S.ul}>
                            <li style={S.li}><strong>Level 1 (Direct Referrals):</strong> Commission earned when someone you directly referred completes activation. This is the highest commission tier.</li>
                            <li style={S.li}><strong>Level 2 (Indirect Referrals):</strong> Commission earned when someone referred by your Level 1 referral completes activation.</li>
                            <li style={S.li}><strong>Level 3 (Tertiary Referrals):</strong> Commission earned when someone referred by your Level 2 referral completes activation.</li>
                        </ul>
                        <p style={S.p}>Referral commission rates, denominated in local currency, are configured by administrators and may vary by country. Commission rates are subject to change at any time at the sole discretion of NEWHOPE. Historical commission rates are not guaranteed to apply to future activations.</p>

                        <h3 style={S.h3}>5.2 Fair Use of the Referral System</h3>
                        <p style={S.p}>The referral program is intended for genuine user acquisition. The following activities are strictly prohibited and constitute fraud:</p>
                        <ul style={S.ul}>
                            <li style={S.li}>Self-referral: Creating multiple accounts to refer yourself and earn commissions</li>
                            <li style={S.li}>Paid referral schemes that promise users guaranteed returns not endorsed by NEWHOPE</li>
                            <li style={S.li}>Referral link spam across social media, messaging apps, or email</li>
                            <li style={S.li}>Misleading advertising or false promises about NEWHOPE earnings when promoting your referral link</li>
                            <li style={S.li}>Referring users who are minors, using someone else's identity, or otherwise violating eligibility requirements</li>
                        </ul>
                        <p style={S.p}>Any commissions earned through fraudulent referral activity will be reversed. Accounts engaged in referral fraud will be permanently terminated. NEWHOPE monitors referral networks using graph analysis and activation pattern detection to identify suspicious activity.</p>

                        <h3 style={S.h3}>5.3 Commission Payment</h3>
                        <p style={S.p}>Referral commissions are credited to the referring user's main balance upon successful activation of the referred user and confirmation of payment by administrators. Commissions may take up to 48 hours after activation to appear in your balance. NEWHOPE does not guarantee any specific earnings from the referral program, and referral income is not a guaranteed or predictable source of revenue.</p>

                        {/* 6 */}
                        <h2 style={S.h2}>6. Withdrawals &amp; Payment Processing</h2>
                        <h3 style={S.h3}>6.1 Eligibility to Withdraw</h3>
                        <p style={S.p}>To be eligible to make a withdrawal, you must:</p>
                        <ul style={S.ul}>
                            <li style={S.li}>Have a fully activated account</li>
                            <li style={S.li}>Have a verified KYC status (where required for your country)</li>
                            <li style={S.li}>Have a main balance that meets or exceeds the minimum withdrawal threshold for your country and payment method</li>
                            <li style={S.li}>Have a registered and verified phone number linked to your account</li>
                            <li style={S.li}>Not be under any active account restriction, suspension, or review</li>
                        </ul>

                        <h3 style={S.h3}>6.2 Minimum Withdrawal Amounts</h3>
                        <p style={S.p}>Minimum withdrawal amounts are denominated in local currency and set by NEWHOPE for each country. These minimums are subject to change at any time. General guidelines (subject to update) include:</p>
                        <ul style={S.ul}>
                            <li style={S.li}><strong>Tanzania (TZS):</strong> Country-specific minimum via mobile money</li>
                            <li style={S.li}><strong>Kenya (KES):</strong> Country-specific minimum via M-Pesa and other mobile operators</li>
                            <li style={S.li}><strong>Uganda (UGX):</strong> Country-specific minimum via MTN or Airtel Money</li>
                            <li style={S.li}><strong>Rwanda (RWF):</strong> Country-specific minimum via MTN or Airtel</li>
                            <li style={S.li}><strong>Burundi (BIF):</strong> Country-specific minimum via mobile money</li>
                            <li style={S.li}><strong>Mozambique (MZN):</strong> Minimum of approximately MZN 200 equivalent via M-Pesa or e-Mola</li>
                            <li style={S.li}><strong>Crypto (All Countries):</strong> Minimum of approximately USD equivalent for USDT/BTC transactions</li>
                        </ul>
                        <p style={S.p}>The exact applicable minimum is displayed within the withdrawal interface of the application and takes precedence over any figures stated in these Terms.</p>

                        <h3 style={S.h3}>6.3 Withdrawal Fees</h3>
                        <p style={S.p}>All withdrawals are subject to a processing fee. The fee is calculated as a percentage of the withdrawal amount. The applicable fee rate is displayed clearly before you confirm any withdrawal. Fees cover payment network charges, processing costs, and administrative overhead. NEWHOPE reserves the right to adjust withdrawal fee rates at any time by updating the application. The updated rate will apply to all withdrawals submitted after the change takes effect.</p>
                        <p style={S.p}>The withdrawal fee is deducted from your balance in addition to the requested withdrawal amount. For example, if you request a withdrawal of 10,000 TZS and the fee rate is 5%, a total of 10,500 TZS will be deducted from your balance (10,000 TZS to you + 500 TZS fee).</p>

                        <h3 style={S.h3}>6.4 Withdrawal Processing Times</h3>
                        <p style={S.p}>Withdrawals are not processed instantaneously. Upon submitting a withdrawal request, it enters a pending state awaiting administrator review and approval. The standard processing timeline is:</p>
                        <ul style={S.ul}>
                            <li style={S.li}><strong>Mobile Money (M-Pesa, Airtel, MTN, etc.):</strong> Processed within 24–72 hours of submission during business days</li>
                            <li style={S.li}><strong>Cryptocurrency (USDT, BTC):</strong> May take up to 5 business days due to compliance review</li>
                            <li style={S.li}><strong>Bank Transfer:</strong> Where available, up to 7 business days</li>
                        </ul>
                        <p style={S.p}>Delays may occur during peak usage periods, public holidays, or during system maintenance. NEWHOPE is not responsible for delays caused by third-party payment processors, mobile network operators, or banking institutions. Once a withdrawal is approved, NEWHOPE will transmit the payment to your registered mobile money account or wallet. Any subsequent delay is outside NEWHOPE's control.</p>

                        <h3 style={S.h3}>6.5 Withdrawal Rejection</h3>
                        <p style={S.p}>NEWHOPE reserves the right to reject or reverse any withdrawal under the following conditions:</p>
                        <ul style={S.ul}>
                            <li style={S.li}>The withdrawal appears to be linked to fraudulent activity</li>
                            <li style={S.li}>The account is under review or restriction at the time of the request</li>
                            <li style={S.li}>The payment details provided are incorrect or unverifiable</li>
                            <li style={S.li}>The requested amount exceeds the available balance after fee deduction</li>
                            <li style={S.li}>The account owner has not completed required KYC verification</li>
                            <li style={S.li}>A system error prevents processing of the payment</li>
                        </ul>
                        <p style={S.p}>In the event of a rejection, the requested amount will be returned to your NEWHOPE balance within 48 hours. NEWHOPE will make reasonable efforts to notify you of the rejection reason.</p>

                        {/* 7 */}
                        <h2 style={S.h2}>7. Shop Balance &amp; Deposits</h2>
                        <p style={S.p}>The NEWHOPE platform features a "Shop Balance," which is a separate internal balance that can be funded by the user to access premium content, purchase digital goods from the NEWHOPE store, or unlock additional platform features. Shop balance is distinct from task earnings and the main withdrawal balance.</p>

                        <h3 style={S.h3}>7.1 Depositing to Shop Balance</h3>
                        <p style={S.p}>Users can fund their shop balance through the following methods:</p>
                        <ul style={S.ul}>
                            <li style={S.li}><strong>Automatic PalmPesa Deposit (Tanzania):</strong> Tanzanian users can use the integrated PalmPesa payment gateway to automatically push a deposit request to their mobile device. The deposit is credited automatically upon confirmed payment.</li>
                            <li style={S.li}><strong>Manual USSD Deposit:</strong> For all supported countries, users can manually send funds to the designated platform mobile money account and then enter their transaction ID in the app. Manual deposits are reviewed and credited by administrators within 24 hours.</li>
                        </ul>
                        <p style={S.p}>All deposits are final and non-refundable. Once credited to your shop balance, funds cannot be withdrawn back to your mobile money account. Shop balance can only be used for platform purchases or as specified by NEWHOPE.</p>

                        <h3 style={S.h3}>7.2 Shop Purchases</h3>
                        <p style={S.p}>Shop balance may be used to purchase digital products, subscription upgrades, premium task access, or other designated items available in the NEWHOPE digital shop. All shop purchases are final and non-refundable unless the item was not delivered due to a verified platform error. In the event of a delivery failure, NEWHOPE will credit your shop balance with the equivalent value of the undelivered item.</p>

                        {/* 8 */}
                        <h2 style={S.h2}>8. KYC Verification</h2>
                        <p style={S.p}>Know Your Customer (KYC) verification is required for users in certain countries or upon reaching specific withdrawal thresholds. KYC helps NEWHOPE comply with anti-money laundering (AML) and counter-terrorism financing (CTF) regulations.</p>

                        <h3 style={S.h3}>8.1 Documents Required</h3>
                        <p style={S.p}>Depending on your country, you may be required to submit one or more of the following identity documents:</p>
                        <ul style={S.ul}>
                            <li style={S.li}>National Identity Card (NID)</li>
                            <li style={S.li}>Passport (biographic page)</li>
                            <li style={S.li}>Voter's ID / Voter Registration Card</li>
                            <li style={S.li}>Driving License</li>
                            <li style={S.li}>Student ID (where accepted)</li>
                            <li style={S.li}>Nida Card (Tanzania specific)</li>
                            <li style={S.li}>Huduma Number Card (Kenya specific)</li>
                        </ul>
                        <p style={S.p}>Documents must be clear, legible, and uploaded in a supported format (JPG, PNG, or PDF). Blurry, cropped, or tampered documents will be rejected and may trigger a review of your account.</p>

                        <h3 style={S.h3}>8.2 KYC Review Process</h3>
                        <p style={S.p}>KYC submissions are reviewed by designated NEWHOPE administrators. The typical review period is 1–5 business days. Users will be notified of their KYC approval or rejection via an in-app notification. If rejected, the reason will be provided and you will be given the opportunity to resubmit with corrected documents. NEWHOPE reserves the right to request additional documentation at any time.</p>

                        <h3 style={S.h3}>8.3 Data Handling of KYC Documents</h3>
                        <p style={S.p}>KYC documents are stored securely and are used solely for identity verification purposes. They will not be shared with third parties except where required by law. KYC documents are retained for a minimum of 5 years in compliance with financial regulations. You have the right to request deletion of your KYC data, subject to legal retention obligations.</p>

                        {/* 9 */}
                        <h2 style={S.h2}>9. Prohibited Conduct</h2>
                        <p style={S.p}>The following activities are strictly prohibited on the NEWHOPE platform. Engaging in any of the following may result in immediate account suspension or permanent termination, forfeiture of all balances, and potential legal action:</p>
                        <ul style={S.ul}>
                            <li style={S.li}><strong>Account Multiplication:</strong> Creating, owning, or operating more than one account for any reason</li>
                            <li style={S.li}><strong>Identity Fraud:</strong> Registering using someone else's identity, name, phone number, or payment credentials</li>
                            <li style={S.li}><strong>Task Automation:</strong> Using bots, scripts, browser automation tools, or click farms to complete tasks</li>
                            <li style={S.li}><strong>Payment Fraud:</strong> Entering false transaction IDs for deposits or activation payments</li>
                            <li style={S.li}><strong>Chargeback Fraud:</strong> Initiating chargebacks on payments made to NEWHOPE through third-party payment services</li>
                            <li style={S.li}><strong>Timezone Manipulation:</strong> Altering device time, timezone settings, or using VPNs with different geographic clocks to manipulate task availability or daily streaks</li>
                            <li style={S.li}><strong>Hacking or Security Circumvention:</strong> Attempting to access, probe, or interfere with the platform's technical infrastructure</li>
                            <li style={S.li}><strong>Exploitation of Bugs:</strong> Exploiting known or unknown software vulnerabilities or bugs to gain unauthorized access to features or funds. All bugs must be reported to support immediately</li>
                            <li style={S.li}><strong>Misleading Promotion:</strong> Promoting NEWHOPE with false claims, exaggerated earnings promises, or unauthorized marketing materials</li>
                            <li style={S.li}><strong>Platform Defamation:</strong> Publicly disparaging, defaming, or spreading false information about NEWHOPE, its staff, or its operations in ways that could cause reputational or financial harm</li>
                            <li style={S.li}><strong>Data Harvesting:</strong> Scraping, crawling, or otherwise extracting user data or platform data without explicit permission</li>
                            <li style={S.li}><strong>Illegal Activity:</strong> Using the platform in connection with any activity that is illegal under the laws of your jurisdiction or international law</li>
                        </ul>

                        {/* 10 */}
                        <h2 style={S.h2}>10. Suspension &amp; Termination</h2>
                        <h3 style={S.h3}>10.1 Voluntary Termination</h3>
                        <p style={S.p}>You may request termination of your NEWHOPE account at any time by contacting our support team. Upon termination, all accumulated balances — including task earnings, main balance, referral commissions, and shop balance — will be permanently forfeited and cannot be recovered or transferred. NEWHOPE is under no obligation to withdraw or disburse any balance remaining at the time of voluntary account termination.</p>

                        <h3 style={S.h3}>10.2 Administrative Suspension</h3>
                        <p style={S.p}>NEWHOPE reserves the right to suspend your account at any time and without prior notice if we have reasonable grounds to believe that you have violated these Terms, engaged in fraudulent activity, or pose a risk to the platform or other users. During suspension, you will be unable to access your account, complete tasks, request withdrawals, or receive commissions.</p>

                        <h3 style={S.h3}>10.3 Permanent Termination</h3>
                        <p style={S.p}>Following an investigation, if NEWHOPE determines that you have engaged in conduct that violates these Terms, your account may be permanently terminated. All balances associated with a permanently terminated account are forfeited without compensation. Permanently terminated users are prohibited from creating new accounts. Circumventing a termination by registering a new account will result in all associated accounts being terminated.</p>

                        <h3 style={S.h3}>10.4 Effect of Termination</h3>
                        <p style={S.p}>Upon account termination (whether voluntary or administrative), your right to use the NEWHOPE platform ceases immediately. NEWHOPE may, at its discretion, retain your data for legal, compliance, or fraud prevention purposes as permitted by applicable law.</p>

                        {/* 11 */}
                        <h2 style={S.h2}>11. Privacy Policy</h2>
                        <h3 style={S.h3}>11.1 Data We Collect</h3>
                        <p style={S.p}>NEWHOPE collects the following categories of personal data when you use the platform:</p>
                        <ul style={S.ul}>
                            <li style={S.li}><strong>Registration Data:</strong> Username, email address, phone number, country</li>
                            <li style={S.li}><strong>Financial Data:</strong> Transaction history, withdrawal requests, deposit records, balance information</li>
                            <li style={S.li}><strong>KYC Data:</strong> Identity documents, full name, date of birth (where applicable)</li>
                            <li style={S.li}><strong>Device Data:</strong> Device type, operating system, browser type, IP address, device fingerprint</li>
                            <li style={S.li}><strong>Usage Data:</strong> Tasks completed, pages visited, time spent on tasks, referral activity</li>
                            <li style={S.li}><strong>Communications:</strong> Support tickets, in-app messages, and any correspondence with NEWHOPE staff</li>
                        </ul>

                        <h3 style={S.h3}>11.2 How We Use Your Data</h3>
                        <p style={S.p}>We use the data we collect for the following purposes:</p>
                        <ul style={S.ul}>
                            <li style={S.li}>To operate, maintain, and improve the NEWHOPE platform</li>
                            <li style={S.li}>To process transactions, withdrawals, and referral commissions</li>
                            <li style={S.li}>To verify your identity and prevent fraud</li>
                            <li style={S.li}>To communicate with you about your account, platform updates, and support requests</li>
                            <li style={S.li}>To enforce these Terms and other policies</li>
                            <li style={S.li}>To comply with legal and regulatory obligations</li>
                            <li style={S.li}>To analyze usage patterns and improve user experience</li>
                        </ul>

                        <h3 style={S.h3}>11.3 Data Sharing</h3>
                        <p style={S.p}>We do not sell your personal data to third parties. We may share your data with trusted service providers who assist us in operating the platform (such as payment processors, cloud hosting providers, and analytics services) under strict data protection agreements. We may also share your data with law enforcement or regulatory authorities if required by law or to protect the rights and safety of our users and the platform.</p>

                        <h3 style={S.h3}>11.4 Data Retention</h3>
                        <p style={S.p}>We retain your personal data for as long as your account is active and for a period thereafter as required by applicable law. KYC documents are retained for a minimum of 5 years. Transaction records are retained for a minimum of 7 years for financial compliance purposes. You may request deletion of your account data by contacting support; however, certain legally required records may be retained regardless of your request.</p>

                        <h3 style={S.h3}>11.5 Your Privacy Rights</h3>
                        <p style={S.p}>Depending on your jurisdiction, you may have certain rights regarding your personal data, including the right to access, correct, delete, or restrict the processing of your personal information. To exercise any of these rights, please contact our support team. We will respond to your request within 30 days.</p>

                        {/* 12 */}
                        <h2 style={S.h2}>12. Intellectual Property</h2>
                        <p style={S.p}>All content on the NEWHOPE platform — including but not limited to text, graphics, logos, icons, images, audio clips, video clips, digital downloads, data compilations, and software — is the property of NEWHOPE DIGITAL VENTURES or its content suppliers and is protected by applicable intellectual property laws.</p>
                        <p style={S.p}>You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the platform for personal, non-commercial purposes. You may not reproduce, modify, copy, distribute, publish, transmit, display, perform, license, create derivative works from, transfer, or sell any content, information, or services obtained from or through the NEWHOPE platform without prior written consent from NEWHOPE.</p>
                        <p style={S.p}>Any feedback, suggestions, ideas, or proposals you submit regarding the platform may be used by NEWHOPE without any obligation to compensate you or maintain confidentiality.</p>

                        {/* 13 */}
                        <h2 style={S.h2}>13. Disclaimers &amp; Limitation of Liability</h2>
                        <h3 style={S.h3}>13.1 No Guaranteed Income</h3>
                        <p style={S.p}>NEWHOPE does not guarantee any specific level of income, earnings, or profit from use of the platform. Earnings depend on your participation level, task availability, referral activity, and other factors that may vary significantly. Any representations of potential earnings shown in promotional materials or testimonials are illustrative only and not a promise of future results. Past earnings of other users do not guarantee your own earnings.</p>

                        <h3 style={S.h3}>13.2 Platform Availability</h3>
                        <p style={S.p}>NEWHOPE provides the platform on an "as is" and "as available" basis without warranties of any kind, either express or implied, including fitness for a particular purpose, merchantability, or non-infringement. We do not warrant that the platform will be uninterrupted, error-free, secure, or free of viruses or other harmful components. We reserve the right to perform maintenance, upgrades, or shutdown the platform at any time without prior notice.</p>

                        <h3 style={S.h3}>13.3 Limitation of Liability</h3>
                        <p style={S.p}>To the fullest extent permitted by applicable law, NEWHOPE and its owners, directors, employees, agents, and partners shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, revenues, data, goodwill, or other intangible losses, resulting from your access to or use of (or inability to access or use) the platform, whether based on warranty, contract, tort, or any other legal theory.</p>
                        <p style={S.p}>In no event shall NEWHOPE's total liability to you for all claims arising out of or related to your use of the platform exceed the total amount you have paid to NEWHOPE in activation and transaction fees during the 90 days immediately preceding the claim.</p>

                        {/* 14 */}
                        <h2 style={S.h2}>14. Community Guidelines</h2>
                        <p style={S.p}>NEWHOPE operates community spaces including in-app chat, support groups, and social media communities. Users participating in these spaces must adhere to the following community guidelines:</p>
                        <ul style={S.ul}>
                            <li style={S.li}>Treat all users with respect and courtesy</li>
                            <li style={S.li}>Do not post harmful, offensive, discriminatory, racist, sexist, or threatening content</li>
                            <li style={S.li}>Do not share misinformation, rumors, or unverified claims about NEWHOPE</li>
                            <li style={S.li}>Do not solicit, promote competing platforms, or engage in unauthorized commercial activities</li>
                            <li style={S.li}>Do not share personal information of yourself or others in public channels</li>
                            <li style={S.li}>Do not flood, spam, or disrupt community conversations</li>
                            <li style={S.li}>Report any content that violates these guidelines to NEWHOPE support</li>
                        </ul>
                        <p style={S.p}>NEWHOPE reserves the right to remove any content that violates community guidelines and to ban users who repeatedly violate these standards. Content moderation decisions are final and binding.</p>

                        {/* 15 */}
                        <h2 style={S.h2}>15. Push Notifications &amp; Communications</h2>
                        <p style={S.p}>By registering for NEWHOPE, you consent to receiving push notifications and in-app messages related to your account activity, task updates, withdrawal status changes, promotional offers, platform announcements, and community news. You may choose to disable push notifications through your device settings; however, doing so may affect your ability to receive time-sensitive information about your account.</p>
                        <p style={S.p}>NEWHOPE may also communicate with you via email at the address registered to your account. You are responsible for monitoring your email for important platform communications. Failure to receive email communications due to incorrect email configuration, spam filters, or user error shall not excuse you from compliance with these Terms.</p>

                        {/* 16 */}
                        <h2 style={S.h2}>16. Spin &amp; Bonus Features</h2>
                        <p style={S.p}>NEWHOPE provides various bonus features including a daily spin wheel, daily login bonuses, chat activity bonuses, and referral streak rewards. These features are provided as additional incentives for active engagement and are not guaranteed as a consistent income source.</p>
                        <p style={S.p}>Spin wheel outcomes are determined by a certified random number generation algorithm. The probability of each reward tier is displayed in the spin interface. NEWHOPE does not manipulate spin outcomes for specific users. Bonuses earned through spin and daily activities are credited to the user's main balance and are subject to the standard withdrawal terms and conditions outlined in Section 6.</p>
                        <p style={S.p}>Bonus features may be modified, adjusted, or removed at any time without prior notice. The availability of coins required to spin may be subject to task completion requirements. Unused coins do not carry monetary value and cannot be withdrawn.</p>

                        {/* 17 */}
                        <h2 style={S.h2}>17. Challenges &amp; Leaderboards</h2>
                        <p style={S.p}>NEWHOPE periodically operates competitive challenge and leaderboard programs where users compete based on referral counts, task completions, or other defined metrics. Challenge rules, eligibility criteria, prize pool distribution, and duration are specific to each challenge and are published within the challenge interface.</p>
                        <p style={S.p}>Challenge prizes are distributed as main balance credits, shop balance credits, or other stated prizes. Prize distribution typically occurs within 7 business days after a challenge concludes. NEWHOPE reserves the right to disqualify any participant found to have violated these Terms or challenge-specific rules. Disqualified participants forfeit their eligible prizes. NEWHOPE's decision on challenge outcomes is final.</p>

                        {/* 18 */}
                        <h2 style={S.h2}>18. Changes to Terms</h2>
                        <p style={S.p}>NEWHOPE may revise these Terms at any time. When we make material changes, we will update the "Last Updated" date at the top of this page and may notify you via in-app notification or email. It is your responsibility to review these Terms periodically. Your continued use of the platform after changes are posted constitutes your acceptance of the revised Terms. If you do not agree with the updated Terms, you must immediately cease using the platform and may request account termination by contacting support.</p>

                        {/* 19 */}
                        <h2 style={S.h2}>19. Governing Law &amp; Dispute Resolution</h2>
                        <p style={S.p}>These Terms shall be governed by and construed in accordance with applicable law. Any dispute arising from or related to these Terms or your use of the NEWHOPE platform shall first be attempted to be resolved through informal negotiation. If the dispute cannot be resolved informally within 30 days, it shall be submitted to binding arbitration. The decision of the arbitrator shall be final and binding and may be entered as a judgment in any court of competent jurisdiction.</p>
                        <p style={S.p}>You agree that any dispute resolution proceedings will be conducted on an individual basis and not as part of a class action or representative proceeding. You waive any right to participate in a class-action lawsuit or class-wide arbitration against NEWHOPE.</p>

                        {/* 20 */}
                        <h2 style={S.h2}>20. Third-Party Links &amp; Integrations</h2>
                        <p style={S.p}>The NEWHOPE platform contains links to third-party websites and integrations with third-party services (including social media platforms like YouTube, TikTok, Facebook, Instagram, Twitter/X, Telegram, and WhatsApp). These third-party services operate under their own terms of service and privacy policies, which you are responsible for reviewing. NEWHOPE is not affiliated with, endorses, or takes responsibility for the content, policies, or practices of any third-party platforms. Your use of third-party platforms in connection with NEWHOPE tasks is at your own risk.</p>
                        <p style={S.p}>NEWHOPE's integration with payment providers such as PalmPesa, M-Pesa, Airtel Money, MTN Mobile Money, and others is subject to those providers' own terms, availability, and service limitations. NEWHOPE shall not be liable for failures, delays, or limitations imposed by third-party payment processors.</p>

                        {/* 21 */}
                        <h2 style={S.h2}>21. Force Majeure</h2>
                        <p style={S.p}>NEWHOPE shall not be liable for any failure or delay in performance due to circumstances beyond its reasonable control, including but not limited to acts of God, natural disasters, government actions, pandemics, civil unrest, war, terrorism, labor disputes, system outages, telecommunications failures, power failures, third-party service failures, cyberattacks, or internet infrastructure failures. In such events, NEWHOPE's obligations will be suspended for the duration of the force majeure event, and we will make reasonable efforts to notify users and resume normal operations as soon as possible.</p>

                        {/* 22 */}
                        <h2 style={S.h2}>22. Contact &amp; Support</h2>
                        <p style={S.p}>For any questions, concerns, complaints, or support requests related to your NEWHOPE account or these Terms, please contact us through:</p>
                        <ul style={S.ul}>
                            <li style={S.li}><strong>In-App Support Chat:</strong> Available via the platform's Help or Support section</li>
                            <li style={S.li}><strong>WhatsApp Support Group:</strong> Country-specific support groups accessible via the floating support bubble in your dashboard</li>
                            <li style={S.li}><strong>Telegram Support Channel:</strong> Available for select countries via the platform</li>
                            <li style={S.li}><strong>Email:</strong> Contact details as provided within the official platform and not through unofficial channels</li>
                        </ul>
                        <p style={S.p}>NEWHOPE aims to respond to all support inquiries within 24–72 hours during business days. We do not guarantee response times on weekends or public holidays. NEWHOPE staff will never ask for your password, PIN, or payment credentials. If anyone claiming to be NEWHOPE support requests such information, immediately report it to the platform and do not comply.</p>

                        {/* 23 */}
                        <h2 style={S.h2}>23. Entire Agreement</h2>
                        <p style={S.p}>These Terms, together with the Privacy Policy and any other policies, guidelines, or rules published on the NEWHOPE platform, constitute the entire agreement between you and NEWHOPE with respect to your use of the platform and supersede any and all prior agreements, representations, and understandings between you and NEWHOPE relating to the subject matter hereof.</p>
                        <p style={S.p}>If any provision of these Terms is found to be invalid, illegal, or unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect. NEWHOPE's failure to enforce any right or provision of these Terms shall not constitute a waiver of that right or provision unless expressly acknowledged in writing by NEWHOPE.</p>

                        <div style={{ ...S.highlight, marginTop: 32 }}>
                            <strong>By using the NEWHOPE platform, you confirm that you have read, understood, and agree to all of the above Terms &amp; Conditions. These Terms are effective as of August 16, 2026, and apply to all users globally.</strong>
                        </div>

                        <p style={{ ...S.p, textAlign: 'center', color: 'var(--text-muted)', marginTop: 24, fontSize: 10.5 }}>
                            © 2026 NEWHOPE DIGITAL VENTURES. All Rights Reserved. &nbsp;|&nbsp; Platform Version 4.2
                        </p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
