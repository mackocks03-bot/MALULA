/**
 * Countries Data
 * All countries from register page
 */

export const COUNTRIES = [
  { code: 'TZ', name: 'Tanzania', flag: 'tz', phoneCode: '+255', digits: 9, currency: 'TZS' },
  { code: 'KE', name: 'Kenya', flag: 'ke', phoneCode: '+254', digits: 9, currency: 'KES' },
  { code: 'UG', name: 'Uganda', flag: 'ug', phoneCode: '+256', digits: 9, currency: 'UGX' },
  { code: 'MW', name: 'Malawi', flag: 'mw', phoneCode: '+265', digits: 9, currency: 'MWK' },
  { code: 'ZM', name: 'Zambia', flag: 'zm', phoneCode: '+260', digits: 9, currency: 'ZMW' },
  { code: 'RW', name: 'Rwanda', flag: 'rw', phoneCode: '+250', digits: 9, currency: 'RWF' },
  { code: 'BI', name: 'Burundi', flag: 'bi', phoneCode: '+257', digits: 8, currency: 'BIF' },
  { code: 'CD', name: 'DR Congo', flag: 'cd', phoneCode: '+243', digits: 9, currency: 'CDF' }
];

/**
 * Get country by code
 */
export function getCountry(code) {
  return COUNTRIES.find(c => c.code === code) || COUNTRIES[0];
}

/**
 * Get country by phone code
 */
export function getCountryByPhoneCode(phoneCode) {
  return COUNTRIES.find(c => c.phoneCode === phoneCode) || COUNTRIES[0];
}

/**
 * Get currency for country
 */
export function getCountryCurrency(code) {
  const country = getCountry(code);
  return country ? country.currency : 'TZS';
}

export default COUNTRIES;