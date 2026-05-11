use rand::random;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct PinHash {
    salt: [u8; 16],
    digest: [u8; 32],
}

#[derive(Clone, Debug, Error, Eq, PartialEq)]
pub enum PinError {
    #[error("PIN must be exactly four digits")]
    InvalidFormat,
    #[error("PIN did not match")]
    VerificationFailed,
}

impl PinHash {
    pub fn new(pin: &str) -> Result<Self, PinError> {
        let salt: [u8; 16] = random();
        Self::with_salt(pin, salt)
    }

    pub fn with_salt(pin: &str, salt: [u8; 16]) -> Result<Self, PinError> {
        validate_pin(pin)?;
        Ok(Self {
            salt,
            digest: digest_pin(pin, &salt),
        })
    }

    pub fn verify(&self, pin: &str) -> Result<(), PinError> {
        validate_pin(pin)?;
        let attempted = digest_pin(pin, &self.salt);
        if constant_time_eq(&attempted, &self.digest) {
            Ok(())
        } else {
            Err(PinError::VerificationFailed)
        }
    }
}

pub fn validate_pin(pin: &str) -> Result<(), PinError> {
    if pin.len() == 4 && pin.bytes().all(|byte| byte.is_ascii_digit()) {
        Ok(())
    } else {
        Err(PinError::InvalidFormat)
    }
}

fn digest_pin(pin: &str, salt: &[u8; 16]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(b"stay-pin-v1");
    hasher.update(salt);
    hasher.update(pin.as_bytes());
    hasher.finalize().into()
}

fn constant_time_eq(left: &[u8; 32], right: &[u8; 32]) -> bool {
    left.iter()
        .zip(right.iter())
        .fold(0_u8, |acc, (left, right)| acc | (left ^ right))
        == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_four_digit_pins() {
        assert!(validate_pin("4821").is_ok());
        assert_eq!(validate_pin("482").unwrap_err(), PinError::InvalidFormat);
        assert_eq!(validate_pin("48210").unwrap_err(), PinError::InvalidFormat);
        assert_eq!(validate_pin("48a1").unwrap_err(), PinError::InvalidFormat);
    }

    #[test]
    fn verifies_hash_without_storing_plain_pin() {
        let hash = PinHash::with_salt("4821", [7; 16]).unwrap();

        assert!(hash.verify("4821").is_ok());
        assert_eq!(
            hash.verify("4822").unwrap_err(),
            PinError::VerificationFailed
        );
    }
}
