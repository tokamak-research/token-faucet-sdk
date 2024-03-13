import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import idl from "./idl/token_faucet.json";
import { createHash } from "crypto";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

export async function build_initialize_token_tx(
    payer: PublicKey,
    token_symbol: string,
    token_decimals: number,
    token_name: string,
    token_uri: string,
    token_limit: number,
    refresh_interval: number,
    program_id: PublicKey,
    provider: AnchorProvider
) {
    const a = JSON.stringify(idl)
    const token_faucet_idl = JSON.parse(a)
    const program = new Program(token_faucet_idl, program_id, provider)

    const [mintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), Buffer.from(token_symbol)],
        program_id
    );

    const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            mintPDA.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
    );

    const [tokenLimiterPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("limit"),
            Buffer.from(token_symbol)
        ],
        program_id
    );

    const instructions: TransactionInstruction[] = [
        await program.methods.tokenInitialize(
            token_symbol,
            token_decimals,
            token_name,
            token_uri,
            token_limit,
            refresh_interval,
        ).accounts({
            admin: payer,
            mintAccount: mintPDA,
            metadataAccount: metadataAddress,
            tokenLimiter: tokenLimiterPDA,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        }).instruction(),
    ];

    return instructions;
}

export async function build_mint_token_tx(
    user: PublicKey,
    token_symbol: String,
    amount: number,
    program_id: PublicKey,
    provider: AnchorProvider
) {
    const a = JSON.stringify(idl)
    const token_faucet_idl = JSON.parse(a)
    const program = new Program(token_faucet_idl, program_id, provider)

    const [mintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), Buffer.from(token_symbol)],
        program_id
    );

    let hexString = createHash('sha256').update(Buffer.concat([user.toBuffer(), mintPDA.toBuffer()])).digest('hex');
    let seed = Uint8Array.from(Buffer.from(hexString, 'hex'));
    const [mintRecordPDA] = PublicKey.findProgramAddressSync(
        [seed],
        program_id
    );

    const [tokenLimiterPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("limit"),
            Buffer.from(token_symbol)
        ],
        program_id
    );

    const target_token_ATA = getAssociatedTokenAddressSync(
        mintPDA,
        user
    );

    const accountInfo = await provider.connection.getAccountInfo(mintRecordPDA);
    const instructions: TransactionInstruction[] = [];

    if (accountInfo == null) {
        const initialize_mint_record = await program.methods.userInitialize()
            .accounts({
                user: user,
                mintRecord: mintRecordPDA,
                mintAccount: mintPDA,
            }).instruction();
        instructions.push(initialize_mint_record);
    }


    const token_mint = await program.methods.tokenMint(token_symbol, amount)
        .accounts({
            user: user,
            mintAccount: mintPDA,
            tokenLimiter: tokenLimiterPDA,
            mintRecord: mintRecordPDA,
            associatedTokenAccount: target_token_ATA
        }).instruction();
    
    instructions.push(token_mint);

    return instructions

}